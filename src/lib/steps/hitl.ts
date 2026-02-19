import type { Run, HITLStepConfig } from "@/lib/engine/types";

export async function executeHITLStep(
  config: HITLStepConfig,
  run: Run
): Promise<{ paused: true }> {
  void config;
  void run;
  return { paused: true };
}
