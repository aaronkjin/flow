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

// Step executor imports — will be implemented in Phase 2
// import { executeLLMStep } from "../steps/llm";
// import { executeJudgeStep } from "../steps/judge";
// import { executeConnectorStep } from "../steps/connector";

// --- Public API ---

/**
 * Start a new run for a workflow.
 * Creates the run record, fires async execution, returns immediately.
 */
export async function startRun(
  workflowId: string,
  input: Record<string, unknown>
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
  };

  // Initialize step states
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

  // Fire-and-forget async execution
  executeRunAsync(workflow, run).catch((err) => {
    console.error(`Run ${run.id} failed unexpectedly:`, err);
  });

  return run;
}

/**
 * Resume a run after HITL decision.
 */
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
    // Mark HITL step as failed and fail the run
    updateStepState(run, hitlStepId, {
      status: "failed",
      error: `Rejected: ${decision.comment || "No reason provided"}`,
      completedAt: new Date().toISOString(),
    });
    updateRunStatus(run, "failed");
    run.error = `Rejected at HITL step: ${decision.comment || "No reason provided"}`;
    runStore.save(run.id, run);

    emitTrace(run.id, { type: "run_failed", data: { error: run.error } });
    return run;
  }

  // Approve or edit — mark HITL step complete
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

  // Continue execution from next step
  executeRunAsync(workflow, run, hitlStepId).catch((err) => {
    console.error(`Run ${run.id} resume failed:`, err);
  });

  return run;
}

/**
 * Startup reconciliation: mark stale "running" runs as failed.
 */
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

// --- Internal Execution ---

/**
 * Async execution loop. Runs steps in topological order.
 * If resumeAfterStepId is provided, starts from the step after it.
 */
async function executeRunAsync(
  workflow: WorkflowDefinition,
  run: Run,
  resumeAfterStepId?: string
): Promise<void> {
  const runStore = getRunStore();

  try {
    if (run.status === "pending") {
      updateRunStatus(run, "running");
      runStore.save(run.id, run);
    }

    const sortedSteps = topologicalSort(workflow.steps, workflow.edges);

    // If resuming, find where to start
    let startIndex = 0;
    if (resumeAfterStepId) {
      const idx = sortedSteps.findIndex((s) => s.id === resumeAfterStepId);
      if (idx !== -1) startIndex = idx + 1;
    }

    for (let i = startIndex; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];

      // Skip already-completed steps
      if (run.stepStates[step.id]?.status === "completed") continue;
      if (run.stepStates[step.id]?.status === "skipped") continue;

      // Check if this step should be skipped (condition routing)
      if (shouldSkipStep(step, workflow, run)) {
        updateStepState(run, step.id, { status: "skipped" });
        runStore.save(run.id, run);
        continue;
      }

      // Build interpolation context
      const context = buildContext(run);

      // Mark step as running
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
        // Dispatch to step executor
        const result = await executeStep(step, context, run, workflow);

        if (result.__hitlPause) {
          // HITL step — pause execution
          updateStepState(run, step.id, { status: "waiting_for_review" });
          updateRunStatus(run, "waiting_for_review");
          runStore.save(run.id, run);

          emitTrace(run.id, {
            type: "hitl_paused",
            stepId: step.id,
            stepName: step.name,
            data: { instructions: (step.config as HITLStepConfig).instructions },
          });
          return; // STOP execution — will resume via resumeRun()
        }

        // Step completed
        updateStepState(run, step.id, {
          status: "completed",
          output: result,
          completedAt: new Date().toISOString(),
        });
        runStore.save(run.id, run);

        emitTrace(run.id, {
          type: "step_completed",
          stepId: step.id,
          stepName: step.name,
          data: { output: result },
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

    // All steps done
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
    runStore.save(run.id, run);
    emitTrace(run.id, { type: "run_failed", data: { error: run.error } });
  }
}

/**
 * Dispatch a step to the appropriate executor.
 */
async function executeStep(
  step: StepDefinition,
  context: InterpolationContext,
  run: Run,
  workflow: WorkflowDefinition
): Promise<Record<string, unknown>> {
  const interpolatedConfig = interpolateObject(step.config, context) as Record<string, unknown>;

  switch (step.type) {
    case "trigger":
      // Trigger is a pass-through — input is already set
      return { ...run.input };

    case "llm": {
      // Dynamic import to avoid circular deps and keep Phase 1 working
      const { executeLLMStep } = await import("../steps/llm");
      return await executeLLMStep(interpolatedConfig, context);
    }

    case "judge": {
      const { executeJudgeStep } = await import("../steps/judge");
      return await executeJudgeStep(interpolatedConfig, context);
    }

    case "hitl": {
      const config = step.config as HITLStepConfig;

      // Check auto-approve: if judge passed and autoApproveOnJudgePass is true
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

    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

// --- Helpers ---

/**
 * Topological sort of steps based on edge connections.
 * Simple Kahn's algorithm.
 */
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

/**
 * Determine if a step should be skipped based on condition routing.
 * A step is skipped if it's only reachable from a condition branch that wasn't taken.
 */
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

  // None of the incoming edges were satisfied; skip the step.
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

  // Default: the source step completed, so the edge is satisfied.
  return true;
}

/**
 * Build interpolation context from current run state.
 */
function buildContext(run: Run): InterpolationContext {
  const steps: Record<string, Record<string, unknown>> = {};

  for (const [stepId, state] of Object.entries(run.stepStates)) {
    if (state.status === "completed" && state.output) {
      steps[stepId] = state.output;
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
