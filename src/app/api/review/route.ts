import { NextResponse } from "next/server";
import type {
  Run,
  HITLStepConfig,
  JudgeResult,
  ReviewItem,
  StepDefinition,
} from "@/lib/engine/types";
import { getWorkflowStore, getRunStore } from "@/lib/persistence/store";

export const dynamic = "force-dynamic";

function buildReviewItem(run: Run): ReviewItem | null {
  const workflow = getWorkflowStore().get(run.workflowId);
  if (!workflow) return null;

  const currentStep = workflow.steps.find(
    (s: StepDefinition) => s.id === run.currentStepId
  );
  if (!currentStep) return null;

  const config = currentStep.config as HITLStepConfig;
  const showSteps = config.showSteps || [];

  const priorStepOutputs: Record<string, Record<string, unknown>> = {};
  let judgeAssessment: JudgeResult | undefined;

  for (const stepId of showSteps) {
    const stepState = run.stepStates[stepId];
    if (stepState?.output) {
      priorStepOutputs[stepId] =
        stepState.output as Record<string, unknown>;

      const stepDef = workflow.steps.find(
        (s: StepDefinition) => s.id === stepId
      );
      if (stepDef?.type === "judge" && stepState.output) {
        judgeAssessment = stepState.output as unknown as JudgeResult;
      }
    }
  }

  return {
    run,
    workflowName: run.workflowName,
    currentStep,
    priorStepOutputs,
    judgeAssessment,
  };
}

export async function GET() {
  const runs = getRunStore().getAll();
  const pendingReviews = runs.filter(
    (r: Run) => r.status === "waiting_for_review"
  );

  const reviews: ReviewItem[] = [];
  for (const run of pendingReviews) {
    const item = buildReviewItem(run);
    if (item) reviews.push(item);
  }

  reviews.sort(
    (a, b) =>
      new Date(a.run.createdAt).getTime() -
      new Date(b.run.createdAt).getTime()
  );

  return NextResponse.json({ reviews });
}

export { buildReviewItem };
