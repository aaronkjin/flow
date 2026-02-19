import { v4 as uuidv4 } from "uuid";
import type {
  WorkflowDefinition,
  Run,
  StepDefinition,
  EdgeDefinition,
  StepState,
  HITLDecision,
  TraceEvent,
  InterpolationContext,
  RunStatus,
  ConditionStepConfig,
  HITLStepConfig,
  JudgeResult,
} from "./types";
import { interpolateObject, evaluateCondition } from "./interpolation";
import {
  getWorkflowStore,
  getRunStore,
  appendToJsonArray,
  getTracePath,
} from "../persistence/store";

export async function startRun(
  workflowId: string,
  input: Record<string, unknown>,
  options?: { parentRunId?: string; parentStepId?: string }
): Promise<Run> {
  const workflowStore = getWorkflowStore();
  const runStore = getRunStore();

  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const now = new Date().toISOString();
  const run: Run = {
    id: uuidv4(),
    workflowId,
    workflowName: workflow.name,
    status: "pending",
    input,
    stepStates: {},
    currentStepId: null,
    createdAt: now,
    updatedAt: now,
    parentRunId: options?.parentRunId,
    parentStepId: options?.parentStepId,
  };

  for (const step of workflow.steps) {
    run.stepStates[step.id] = {
      stepId: step.id,
      status: "pending",
    };
  }

  runStore.save(run.id, run);

  emitTrace(run.id, {
    type: "run_started",
    data: { workflowId, workflowName: workflow.name, input },
  });

  executeRunAsync(workflow, run).catch((err) => {
    console.error(`Run ${run.id} failed unexpectedly:`, err);
  });

  return run;
}

export async function resumeRun(
  runId: string,
  decision: HITLDecision
): Promise<Run> {
  const runStore = getRunStore();
  const workflowStore = getWorkflowStore();

  const run = runStore.get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  if (run.status !== "waiting_for_review") {
    throw new Error(`Run ${runId} is not waiting for review (status: ${run.status})`);
  }

  const workflow = workflowStore.get(run.workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${run.workflowId}`);

  const hitlStepId = run.currentStepId;
  if (!hitlStepId) throw new Error("No current step to resume");

  const hitlStep = workflow.steps.find((s) => s.id === hitlStepId);
  if (!hitlStep) throw new Error(`HITL step not found for id ${hitlStepId}`);
  const hitlConfig = hitlStep.config as HITLStepConfig;

  emitTrace(run.id, {
    type: "hitl_resumed",
    stepId: hitlStepId,
    data: { decision },
  });

  if (decision.action === "reject") {
    updateStepState(run, hitlStepId, {
      status: "failed",
      error: `Rejected: ${decision.comment || "No reason provided"}`,
      completedAt: new Date().toISOString(),
    });
    updateRunStatus(run, "failed");
    run.error = `Rejected at HITL step: ${decision.comment || "No reason provided"}`;

    run.tokenUsage = buildTokenUsageFromSteps(run);

    runStore.save(run.id, run);

    emitTrace(run.id, { type: "run_failed", data: { error: run.error } });
    return run;
  }

  if (hitlStep.type === "sub-workflow") {
    updateStepState(run, hitlStepId, { status: "pending" });
    updateRunStatus(run, "running");
    runStore.save(run.id, run);

    executeRunAsync(workflow, run).catch((err) => {
      console.error(`Run ${run.id} sub-workflow resume failed:`, err);
    });

    return run;
  }

  const hitlOutput: Record<string, unknown> = {
    decision: decision.action,
    comment: decision.comment,
  };
  if (decision.action === "edit" && decision.editedOutput) {
    hitlOutput.editedOutput = decision.editedOutput;
    const targetStepId =
      decision.targetStepId ||
      hitlConfig.reviewTargetStepId ||
      hitlConfig.showSteps?.[0];
    if (targetStepId && run.stepStates[targetStepId]) {
      run.stepStates[targetStepId].output = decision.editedOutput;
    }
  }

  updateStepState(run, hitlStepId, {
    status: "completed",
    output: hitlOutput,
    completedAt: new Date().toISOString(),
  });

  updateRunStatus(run, "running");
  runStore.save(run.id, run);

  executeRunAsync(workflow, run, hitlStepId).catch((err) => {
    console.error(`Run ${run.id} resume failed:`, err);
  });

  return run;
}

export function reconcileStaleRuns(): void {
  const runStore = getRunStore();
  const stale = runStore.getAll().filter((r) => r.status === "running");
  for (const run of stale) {
    run.status = "failed";
    run.error = "Run was interrupted (server restart)";
    run.updatedAt = new Date().toISOString();
    runStore.save(run.id, run);
    emitTrace(run.id, {
      type: "run_failed",
      data: { error: run.error },
    });
  }
  if (stale.length > 0) {
    console.log(`Reconciled ${stale.length} stale runs`);
  }
}

async function executeRunAsync(
  workflow: WorkflowDefinition,
  run: Run,
  resumeAfterStepId?: string
): Promise<void> {
  const runStore = getRunStore();
  const { TokenTracker } = await import("./token-tracking");
  const tokenTracker = new TokenTracker();

  try {
    if (run.status === "pending") {
      updateRunStatus(run, "running");
      runStore.save(run.id, run);
    }

    for (const [stepId, state] of Object.entries(run.stepStates)) {
      if (state.status === "completed" && state.output) {
        const out = state.output as Record<string, unknown>;
        if (out.usage) {
          const u = out.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
          tokenTracker.addUsage(stepId, {
            promptTokens: u.promptTokens ?? 0,
            completionTokens: u.completionTokens ?? 0,
            totalTokens: u.totalTokens ?? 0,
          }, (out.model as string) ?? undefined);
        }
        if (out.totalUsage) {
          const u = out.totalUsage as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
          tokenTracker.addUsage(stepId, {
            promptTokens: u.promptTokens ?? 0,
            completionTokens: u.completionTokens ?? 0,
            totalTokens: u.totalTokens ?? 0,
          }, (out.model as string) ?? undefined);
        }
      }
    }

    const sortedSteps = topologicalSort(workflow.steps, workflow.edges);

    let startIndex = 0;
    if (resumeAfterStepId) {
      const idx = sortedSteps.findIndex((s) => s.id === resumeAfterStepId);
      if (idx !== -1) startIndex = idx + 1;
    }

    for (let i = startIndex; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];

      if (run.stepStates[step.id]?.status === "completed") continue;
      if (run.stepStates[step.id]?.status === "skipped") continue;

      if (shouldSkipStep(step, workflow, run)) {
        updateStepState(run, step.id, { status: "skipped" });
        runStore.save(run.id, run);
        continue;
      }

      const context = buildContext(run);

      run.currentStepId = step.id;
      updateStepState(run, step.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      runStore.save(run.id, run);

      emitTrace(run.id, {
        type: "step_started",
        stepId: step.id,
        stepName: step.name,
        data: { stepType: step.type, config: step.config },
      });

      try {
        const result = await executeStep(step, context, run, workflow);

        if (result.__hitlPause) {
          updateStepState(run, step.id, { status: "waiting_for_review", output: result });
          updateRunStatus(run, "waiting_for_review");
          runStore.save(run.id, run);

          emitTrace(run.id, {
            type: "hitl_paused",
            stepId: step.id,
            stepName: step.name,
            data: { instructions: (step.config as HITLStepConfig).instructions },
          });
          return;
        }

        updateStepState(run, step.id, {
          status: "completed",
          output: result,
          completedAt: new Date().toISOString(),
        });
        runStore.save(run.id, run);

        if (result.usage) {
          const usage = result.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
          tokenTracker.addUsage(step.id, {
            promptTokens: usage.promptTokens ?? 0,
            completionTokens: usage.completionTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
          }, (result.model as string) ?? undefined);
        }
        if (result.totalUsage) {
          const u = result.totalUsage as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
          tokenTracker.addUsage(step.id, {
            promptTokens: u.promptTokens ?? 0,
            completionTokens: u.completionTokens ?? 0,
            totalTokens: u.totalTokens ?? 0,
          }, (result.model as string) ?? undefined);
        }

        emitTrace(run.id, {
          type: "step_completed",
          stepId: step.id,
          stepName: step.name,
          data: {
            output: result,
            usage: result.usage ?? result.totalUsage ?? undefined,
            model: result.model ?? undefined,
          },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateStepState(run, step.id, {
          status: "failed",
          error: errorMsg,
          completedAt: new Date().toISOString(),
        });
        updateRunStatus(run, "failed");
        run.error = `Step "${step.name}" failed: ${errorMsg}`;
        run.tokenUsage = tokenTracker.getSummary();
        runStore.save(run.id, run);

        emitTrace(run.id, {
          type: "step_failed",
          stepId: step.id,
          stepName: step.name,
          data: { error: errorMsg },
        });
        emitTrace(run.id, { type: "run_failed", data: { error: run.error } });
        return;
      }
    }

    run.tokenUsage = tokenTracker.getSummary();
    updateRunStatus(run, "completed");
    run.completedAt = new Date().toISOString();
    run.currentStepId = null;
    runStore.save(run.id, run);

    emitTrace(run.id, {
      type: "run_completed",
      data: { duration: Date.now() - new Date(run.createdAt).getTime() },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updateRunStatus(run, "failed");
    run.error = `Unexpected engine error: ${errorMsg}`;
    run.tokenUsage = tokenTracker.getSummary();
    runStore.save(run.id, run);
    emitTrace(run.id, { type: "run_failed", data: { error: run.error } });
  }
}

async function executeStep(
  step: StepDefinition,
  context: InterpolationContext,
  run: Run,
  workflow: WorkflowDefinition
): Promise<Record<string, unknown>> {
  const interpolatedConfig = interpolateObject(step.config, context) as Record<string, unknown>;

  switch (step.type) {
    case "trigger":
      return { ...run.input };

    case "llm": {
      const { executeLLMStep } = await import("../steps/llm");
      return await executeLLMStep(interpolatedConfig, context);
    }

    case "judge": {
      const { executeJudgeStep } = await import("../steps/judge");
      return await executeJudgeStep(interpolatedConfig, context);
    }

    case "hitl": {
      const config = step.config as HITLStepConfig;

      if (config.autoApproveOnJudgePass) {
        const judgeStepId =
          config.judgeStepId ||
          config.showSteps?.find((candidateId) => {
            const candidate = workflow.steps.find((s) => s.id === candidateId);
            return candidate?.type === "judge";
          });
        if (judgeStepId) {
          const judgeOutput = run.stepStates[judgeStepId]?.output as JudgeResult | undefined;
          if (judgeOutput?.recommendation === "pass") {
            return {
              autoApproved: true,
              reason: "Judge passed above threshold",
              judgeStepId,
            };
          }
        }
      }

      return { __hitlPause: true };
    }

    case "connector": {
      const { executeConnectorStep } = await import("../steps/connector");
      return await executeConnectorStep(interpolatedConfig, context);
    }

    case "condition": {
      const condConfig = step.config as ConditionStepConfig;
      const result = evaluateCondition(condConfig.expression, context);
      return { result, branch: result ? "yes" : "no" };
    }

    case "agent": {
      const { executeAgentStep } = await import("../steps/agent");
      const boundEmitTrace = (event: Omit<TraceEvent, "id" | "runId" | "timestamp">) => {
        emitTrace(run.id, { ...event, stepId: step.id, stepName: step.name });
      };
      return await executeAgentStep(interpolatedConfig, context, boundEmitTrace);
    }

    case "sub-workflow": {
      const { executeSubWorkflowStep } = await import("../steps/sub-workflow");
      const boundEmitTrace = (event: Omit<TraceEvent, "id" | "runId" | "timestamp">) => {
        emitTrace(run.id, { ...event, stepId: step.id, stepName: step.name });
      };
      const existingChildRunId = (
        run.stepStates[step.id]?.output as Record<string, unknown> | undefined
      )?.childRunId as string | undefined;
      if (existingChildRunId) {
        interpolatedConfig.__existingChildRunId = existingChildRunId;
      }
      return await executeSubWorkflowStep(interpolatedConfig, context, boundEmitTrace);
    }

    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

 
export function topologicalSort(
  steps: StepDefinition[],
  edges: EdgeDefinition[]
): StepDefinition[] {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.id, 0);
    adjacency.set(step.id, []);
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (targets) targets.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: StepDefinition[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const step = stepMap.get(id);
    if (step) sorted.push(step);

    for (const neighbor of adjacency.get(id) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== steps.length) {
    throw new Error("Workflow contains a cycle or unreachable steps; unable to compute execution order.");
  }

  return sorted;
}

function shouldSkipStep(
  step: StepDefinition,
  workflow: WorkflowDefinition,
  run: Run
): boolean {
  const incomingEdges = workflow.edges.filter((e) => e.target === step.id);
  if (incomingEdges.length === 0) return false;

  for (const edge of incomingEdges) {
    const sourceStep = workflow.steps.find((s) => s.id === edge.source);
    if (!sourceStep) continue;

    if (isEdgeSatisfied(edge, sourceStep, run)) {
      return false;
    }
  }

  return true;
}

function isEdgeSatisfied(
  edge: EdgeDefinition,
  sourceStep: StepDefinition,
  run: Run
): boolean {
  const sourceState = run.stepStates[sourceStep.id];
  if (!sourceState || sourceState.status !== "completed") {
    return false;
  }

  const edgeLabel = edge.sourceHandle || edge.label;

  if (sourceStep.type === "condition") {
    const branch = (sourceState.output as Record<string, unknown> | undefined)?.branch as
      | string
      | undefined;
    if (!edgeLabel) {
      return typeof branch !== "undefined";
    }
    return branch === edgeLabel;
  }

  if (sourceStep.type === "judge") {
    const recommendation = (sourceState.output as Record<string, unknown> | undefined)?.recommendation as
      | string
      | undefined;
    if (!edgeLabel) return recommendation === "pass";
    if (edgeLabel === "pass") return recommendation === "pass";
    if (edgeLabel === "flag") return recommendation !== "pass";
    return recommendation === edgeLabel;
  }

  if (sourceStep.type === "hitl") {
    const decision = (sourceState.output as Record<string, unknown> | undefined)?.decision as
      | string
      | undefined;
    if (!edgeLabel) return decision === "approve" || decision === "edit";
    if (edgeLabel === "approve") return decision === "approve" || decision === "edit";
    if (edgeLabel === "reject") return decision === "reject";
    return decision === edgeLabel;
  }

  return true;
}

function buildContext(run: Run): InterpolationContext {
  const steps: Record<string, Record<string, unknown>> = {};

  for (const [stepId, state] of Object.entries(run.stepStates)) {
    if (state.status === "completed" && state.output) {
      const output = { ...state.output };

      if (
        typeof output.result === "object" &&
        output.result !== null &&
        !Array.isArray(output.result)
      ) {
        const resultObj = output.result as Record<string, unknown>;
        for (const [key, value] of Object.entries(resultObj)) {
          if (!(key in output)) {
            output[key] = value;
          }
        }
      }

      steps[stepId] = output;
    }
  }

  return { input: run.input, steps };
}

function updateRunStatus(run: Run, status: RunStatus): void {
  run.status = status;
  run.updatedAt = new Date().toISOString();
}

function updateStepState(
  run: Run,
  stepId: string,
  updates: Partial<StepState>
): void {
  if (!run.stepStates[stepId]) {
    run.stepStates[stepId] = { stepId, status: "pending" };
  }
  Object.assign(run.stepStates[stepId], updates);
}

function buildTokenUsageFromSteps(run: Run) {
  const total = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const byStep: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number }> = {};
  let cost = 0;

  let estimateCostFn: ((model: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => number) | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    estimateCostFn = require("./token-tracking").estimateCost;
  } catch {
    estimateCostFn = null;
  }

  for (const [stepId, state] of Object.entries(run.stepStates)) {
    if (state.status !== "completed" || !state.output) continue;
    const out = state.output as Record<string, unknown>;
    const usageRaw = (out.usage ?? out.totalUsage) as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
    if (!usageRaw) continue;

    const u = {
      promptTokens: usageRaw.promptTokens ?? 0,
      completionTokens: usageRaw.completionTokens ?? 0,
      totalTokens: usageRaw.totalTokens ?? 0,
    };
    byStep[stepId] = u;
    total.promptTokens += u.promptTokens;
    total.completionTokens += u.completionTokens;
    total.totalTokens += u.totalTokens;

    const model = out.model as string | undefined;
    if (model && estimateCostFn) {
      cost += estimateCostFn(model, u);
    }
  }

  return { total, byStep, estimatedCostUsd: cost };
}

function emitTrace(
  runId: string,
  event: Omit<TraceEvent, "id" | "runId" | "timestamp">
): void {
  const traceEvent: TraceEvent = {
    id: uuidv4(),
    runId,
    timestamp: new Date().toISOString(),
    ...event,
  } as TraceEvent;

  try {
    appendToJsonArray(getTracePath(runId), traceEvent);
  } catch (err) {
    console.error("Failed to write trace event:", err);
  }
}
