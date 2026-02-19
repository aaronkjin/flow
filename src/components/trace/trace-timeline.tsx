"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { TraceEventDetail } from "./trace-event-detail";
import { TokenUsageBadge } from "./token-usage-badge";
import type { TraceEvent, TraceEventType } from "@/lib/engine/types";

const dotColors: Record<TraceEventType, string> = {
  run_started: "bg-emerald-400",
  run_completed: "bg-emerald-400",
  step_started: "bg-sky-400",
  step_completed: "bg-sky-400",
  step_failed: "bg-rose-400",
  run_failed: "bg-rose-400",
  llm_call: "bg-violet-400",
  judge_result: "bg-amber-400",
  hitl_paused: "bg-emerald-400",
  hitl_resumed: "bg-emerald-400",
  connector_fired: "bg-violet-400",
  agent_iteration: "bg-rose-400",
  agent_tool_call: "bg-rose-400",
  agent_complete: "bg-rose-400",
  sub_workflow_started: "bg-orange-400",
  sub_workflow_completed: "bg-orange-400",
};

const badgeStyles: Record<TraceEventType, string> = {
  run_started: "bg-emerald-50 text-emerald-700 border-emerald-200",
  run_completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  step_started: "bg-sky-50 text-sky-700 border-sky-200",
  step_completed: "bg-sky-50 text-sky-700 border-sky-200",
  step_failed: "bg-rose-50 text-rose-700 border-rose-200",
  run_failed: "bg-rose-50 text-rose-700 border-rose-200",
  llm_call: "bg-violet-50 text-violet-700 border-violet-200",
  judge_result: "bg-amber-50 text-amber-700 border-amber-200",
  hitl_paused: "bg-amber-50 text-amber-700 border-amber-200",
  hitl_resumed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  connector_fired: "bg-violet-50 text-violet-700 border-violet-200",
  agent_iteration: "bg-rose-50 text-rose-700 border-rose-200",
  agent_tool_call: "bg-rose-50 text-rose-700 border-rose-200",
  agent_complete: "bg-rose-50 text-rose-700 border-rose-200",
  sub_workflow_started: "bg-orange-50 text-orange-700 border-orange-200",
  sub_workflow_completed: "bg-orange-50 text-orange-700 border-orange-200",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function formatDeltaMs(ms: number): string {
  if (ms < 1000) return `+${Math.round(ms)}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
  return `+${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function getEventSummary(event: TraceEvent): string {
  const d = event.data;
  switch (event.type) {
    case "llm_call": {
      const model = d.model as string | undefined;
      const tokens = (d.usage as { totalTokens?: number } | undefined)?.totalTokens;
      return [model, tokens ? `${tokens} tokens` : null].filter(Boolean).join(" | ") || "LLM call";
    }
    case "judge_result": {
      const rec = d.recommendation as string | undefined;
      const conf = d.overallConfidence as number | undefined;
      return [rec, conf !== undefined ? `${Math.round(conf * 100)}%` : null].filter(Boolean).join(" | ") || "Judge result";
    }
    case "connector_fired": {
      const ct = d.connectorType as string | undefined;
      const action = d.action as string | undefined;
      return [ct, action].filter(Boolean).join(": ") || "Connector fired";
    }
    case "step_failed":
    case "run_failed": {
      const error = d.error as string | undefined;
      return error ? error.slice(0, 80) : "Failed";
    }
    case "agent_iteration": {
      const idx = d.iterationIndex as number | undefined;
      const toolName = d.toolName as string | undefined;
      return `Iteration ${(idx ?? 0) + 1}${toolName ? ` | ${toolName}` : ""}`;
    }
    case "agent_tool_call": {
      const toolName = d.toolName as string | undefined;
      const success = d.success as boolean | undefined;
      return `${toolName ?? "tool"} | ${success ? "OK" : "Failed"}`;
    }
    case "agent_complete": {
      const reason = d.stopReason as string | undefined;
      const iters = d.totalIterations as number | undefined;
      return `${reason ?? "done"} | ${iters ?? 0} iterations`;
    }
    case "sub_workflow_started": {
      const wfName = d.workflowName as string | undefined;
      return wfName ? `Started: ${wfName}` : "Sub-workflow started";
    }
    case "sub_workflow_completed": {
      const wfName = d.workflowName as string | undefined;
      return wfName ? `Completed: ${wfName}` : "Sub-workflow completed";
    }
    default:
      return "";
  }
}

function formatEventLabel(type: TraceEventType): string {
  return type.replace(/_/g, " ");
}

interface TraceTimelineProps {
  events: TraceEvent[];
  kbFocusedIndex?: number;
}

export function TraceTimeline({ events, kbFocusedIndex }: TraceTimelineProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const eventRefs = useRef<Map<number, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    if (kbFocusedIndex == null || kbFocusedIndex < 0) return;
    const el = eventRefs.current.get(kbFocusedIndex);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [kbFocusedIndex]);

  if (events.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No trace events yet
      </p>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const isKbNavActive = kbFocusedIndex != null && kbFocusedIndex >= 0;

  return (
    <div className="space-y-2">
      {sorted.map((event, i) => {
        const isOpen = isKbNavActive ? i === kbFocusedIndex : openIds.has(event.id);
        const isKbFocused = isKbNavActive && i === kbFocusedIndex;
        const prevTime = i > 0 ? new Date(sorted[i - 1].timestamp).getTime() : null;
        const curTime = new Date(event.timestamp).getTime();
        const delta = prevTime !== null ? curTime - prevTime : null;
        const summary = getEventSummary(event);

        return (
          <Collapsible
            key={event.id}
            open={isOpen}
            onOpenChange={(open) => {
              if (isKbNavActive) return;
              setOpenIds((prev) => {
                const next = new Set(prev);
                if (open) next.add(event.id);
                else next.delete(event.id);
                return next;
              });
            }}
          >
            <div
              ref={(el) => {
                if (el) eventRefs.current.set(i, el);
                else eventRefs.current.delete(i);
              }}
              className={`rounded-lg border transition-colors ${
                isKbFocused
                  ? "border-orange-500/30 bg-orange-500/[0.04] outline outline-2 outline-orange-500/50 outline-offset-[-2px]"
                  : "border-border/60 bg-background hover:bg-muted/20"
              }`}
            >
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left px-5 py-3.5 group">
                <div className={`size-2.5 rounded-full shrink-0 ${dotColors[event.type]}`} />

                <ChevronRight
                  className={`size-4 shrink-0 text-muted-foreground/40 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />

                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 shrink-0 font-medium capitalize ${badgeStyles[event.type]}`}
                >
                  {formatEventLabel(event.type)}
                </Badge>

                {event.stepName && (
                  <span className="text-sm font-medium truncate">{event.stepName}</span>
                )}

                {summary && (
                  <span className="text-sm text-muted-foreground/60 truncate hidden sm:inline">
                    {summary}
                  </span>
                )}

                {event.type === "step_completed" && (() => {
                  const u = event.data.usage as { totalTokens?: number; promptTokens?: number; completionTokens?: number } | undefined;
                  if (!u?.totalTokens) return null;
                  return <TokenUsageBadge compact totalTokens={u.totalTokens} promptTokens={u.promptTokens ?? 0} completionTokens={u.completionTokens ?? 0} />;
                })()}

                <div className="ml-auto shrink-0 flex items-center gap-3">
                  {delta !== null && delta > 0 && (
                    <span className="text-xs text-muted-foreground/30 font-mono">
                      {formatDeltaMs(delta)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/40 font-mono">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-5 pb-4 pt-0">
                  <div className="border-t border-border/40 pt-3 ml-[46px]">
                    <TraceEventDetail event={event} />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
