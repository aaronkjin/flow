import type { Run, HITLStepConfig } from "@/lib/engine/types";

/**
 * HITL step executor — signals the engine to pause for human review.
 * Full implementation in Phase 2.
 */
export async function executeHITLStep(
  config: HITLStepConfig,
  run: Run
): Promise<{ paused: true }> {
  void config;
  void run;
  return { paused: true };
}
