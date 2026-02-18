"use client";

import type { Run, StepDefinition, StepStatus } from "@/lib/engine/types";

const segmentColors: Record<StepStatus, string> = {
  completed: "bg-emerald-400/80",
  running: "bg-sky-300/70 animate-pulse",
  failed: "bg-rose-400/80",
  waiting_for_review: "bg-amber-300/70 animate-pulse",
  pending: "bg-muted",
  skipped: "bg-muted/60",
};

const labelColors: Record<StepStatus, string> = {
  completed: "text-emerald-600/80",
  running: "text-sky-600/80",
  failed: "text-rose-600/80",
  waiting_for_review: "text-amber-600/80",
  pending: "text-muted-foreground/40",
  skipped: "text-muted-foreground/30",
};

interface RunProgressProps {
  run: Run;
  steps: StepDefinition[];
}

export function RunProgress({ run, steps }: RunProgressProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Segmented progress bar */}
      <div className="flex gap-2 h-2 w-full">
        {steps.map((step) => {
          const state = run.stepStates[step.id];
          const status: StepStatus = state?.status ?? "pending";
          return (
            <div
              key={step.id}
              className={`flex-1 rounded-md transition-colors duration-500 ${segmentColors[status]}`}
            />
          );
        })}
      </div>

      {/* Step labels underneath, aligned to segments */}
      <div className="flex gap-2">
        {steps.map((step) => {
          const state = run.stepStates[step.id];
          const status: StepStatus = state?.status ?? "pending";
          return (
            <div key={step.id} className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium truncate block ${labelColors[status]}`}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
