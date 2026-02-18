"use client";

import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/lib/engine/types";

const statusConfig: Record<RunStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-stone-100 text-stone-500 border-stone-200" },
  running: { label: "Running", className: "bg-sky-50 text-sky-600 border-sky-200" },
  waiting_for_review: { label: "In Review", className: "bg-amber-50 text-amber-600 border-amber-200" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-600 border-rose-200" },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
