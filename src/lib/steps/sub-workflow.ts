import type { InterpolationContext, TraceEvent } from "@/lib/engine/types";
import { interpolate } from "@/lib/engine/interpolation";
import { getWorkflowStore, getRunStore } from "@/lib/persistence/store";

const MAX_POLL_MS = 300_000;
const POLL_INTERVAL_MS = 200;

export async function executeSubWorkflowStep(
  config: Record<string, unknown>,
  context: InterpolationContext,
  emitTrace?: (event: Omit<TraceEvent, "id" | "runId" | "timestamp">) => void
): Promise<Record<string, unknown>> {
  const workflowId = config.workflowId as string;
  const inputMapping = (config.inputMapping ?? {}) as Record<string, string>;
  const existingChildRunId = config.__existingChildRunId as string | undefined;

  if (!workflowId) {
    throw new Error("Sub-workflow step: workflowId is required");
  }

  const workflow = getWorkflowStore().get(workflowId);
  if (!workflow) {
    throw new Error(`Sub-workflow step: workflow not found: ${workflowId}`);
  }

  let childRunId: string;

  if (existingChildRunId) {
    childRunId = existingChildRunId;
  } else {
    const childInput: Record<string, unknown> = {};
    for (const [fieldName, template] of Object.entries(inputMapping)) {
      const resolved = interpolate(template, context);
      try {
        childInput[fieldName] = JSON.parse(resolved);
      } catch {
        childInput[fieldName] = resolved;
      }
    }

    const { startRun } = await import("@/lib/engine/engine");
    const childRun = await startRun(workflowId, childInput);
    childRunId = childRun.id;

    emitTrace?.({
      type: "sub_workflow_started",
      data: {
        workflowId,
        workflowName: workflow.name,
        childRunId,
      },
    });
  }

  const result = await pollChildRun(childRunId, workflow);

  if (result.__hitlPause) {
    return result;
  }

  emitTrace?.({
    type: "sub_workflow_completed",
    data: {
      workflowId,
      workflowName: workflow.name,
      childRunId,
    },
  });

  return result;
}

async function pollChildRun(
  childRunId: string,
  workflow: {
    blockConfig?: {
      outputStepId?: string;
      outputFields?: string[];
    };
  }
): Promise<Record<string, unknown>> {
  const runStore = getRunStore();
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const currentRun = runStore.get(childRunId);
    if (!currentRun) {
      throw new Error(`Sub-workflow step: child run ${childRunId} disappeared`);
    }

    switch (currentRun.status) {
      case "completed": {
        let output: Record<string, unknown> = {};

        if (workflow.blockConfig?.outputStepId) {
          const stepState =
            currentRun.stepStates[workflow.blockConfig.outputStepId];
          if (stepState?.output) {
            output = stepState.output;
          }
        } else {
          const completedSteps = Object.values(currentRun.stepStates).filter(
            (s) => s.status === "completed" && s.output
          );
          if (completedSteps.length > 0) {
            output = completedSteps[completedSteps.length - 1].output!;
          }
        }

        if (workflow.blockConfig?.outputFields?.length) {
          const filtered: Record<string, unknown> = {};
          for (const field of workflow.blockConfig.outputFields) {
            if (field in output) {
              filtered[field] = output[field];
            }
          }
          output = filtered;
        }

        return { childRunId, ...output };
      }
      case "failed":
        throw new Error(
          `Sub-workflow failed: ${currentRun.error || "Unknown error"}`
        );
      case "waiting_for_review":
        return {
          __hitlPause: true,
          childRunId,
          reason: "Child workflow waiting for review",
        };
    }
  }

  throw new Error("Sub-workflow timed out after 300s");
}
