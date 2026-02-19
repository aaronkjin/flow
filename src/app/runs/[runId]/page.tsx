"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useZoneNav } from "@/hooks/use-zone-nav";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/run/run-status-badge";
import { RunProgress } from "@/components/run/run-progress";
import { TraceTimeline } from "@/components/trace/trace-timeline";
import { Loader2 } from "lucide-react";
import type { Run, TraceEvent, WorkflowDefinition } from "@/lib/engine/types";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const { setZones, activeZone } = useZoneNav();
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [traceNavActive, setTraceNavActive] = useState(false);

  useEffect(() => {
    setZones(["sidebar", "content"]);
  }, [setZones]);

  const isContentActive = activeZone === "content";

  useEffect(() => {
    if (!isContentActive) setTraceNavActive(false);
  }, [isContentActive]);

  const fetchRunData = useCallback(async () => {
    try {
      const [runRes, traceRes] = await Promise.all([
        fetch(`/api/runs/${runId}`, { cache: "no-store" }),
        fetch(`/api/runs/${runId}/trace`, { cache: "no-store" }),
      ]);

      let traceEventsFromRun: TraceEvent[] = [];

      if (runRes.ok) {
        const runData = await runRes.json();
        const fetchedRun = runData.run as Run;
        setRun(fetchedRun);

        if (Array.isArray(runData.traceEvents)) {
          traceEventsFromRun = runData.traceEvents;
        }

        if (fetchedRun?.workflowId) {
          const wfRes = await fetch(`/api/workflows/${fetchedRun.workflowId}`);
          if (wfRes.ok) {
            const { workflow } = (await wfRes.json()) as {
              workflow: WorkflowDefinition;
            };
            setWorkflow(workflow);
          }
        }
      }

      if (traceRes.ok) {
        const data = await traceRes.json();
        const evts = data.events ?? data;
        if (Array.isArray(evts) && evts.length > 0) {
          setEvents(evts);
        } else if (traceEventsFromRun.length > 0) {
          setEvents(traceEventsFromRun);
        } else {
          setEvents([]);
        }
      } else if (traceEventsFromRun.length > 0) {
        setEvents(traceEventsFromRun);
      }
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRunData();
  }, [fetchRunData]);

  useEffect(() => {
    if (!run) return;
    const terminal = run.status === "completed" || run.status === "failed";
    if (terminal) return;

    const interval = setInterval(fetchRunData, 3000);
    return () => clearInterval(interval);
  }, [run, fetchRunData]);

  useEffect(() => {
    const onFocus = () => fetchRunData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchRunData]);

  const hasTokenUsage = !!run?.tokenUsage;
  const hasAgentSummary = events.some((e) => e.type === "agent_complete");

  let cardIdx = 0;
  const statusIdx = cardIdx++;
  const progressIdx = workflow ? cardIdx++ : -1;
  const tokenIdx = hasTokenUsage ? cardIdx++ : -1;
  const agentIdx = hasAgentSummary ? cardIdx++ : -1;
  const traceIdx = cardIdx++;
  const cardCount = cardIdx;

  const cardOnSelect = useCallback(
    (index: number) => {
      if (index === statusIdx && run?.status === "waiting_for_review") {
        router.push(`/review/${runId}`);
      }
      if (index === traceIdx) setTraceNavActive(true);
    },
    [statusIdx, traceIdx, run?.status, router, runId],
  );

  const { getItemProps } = useKeyboardNav({
    itemCount: cardCount,
    onSelect: cardOnSelect,
    enabled: isContentActive && !traceNavActive,
  });

  const traceOnSelect = useCallback(() => {}, []);
  const { focusedIndex: traceFocusedIndex } = useKeyboardNav({
    itemCount: events.length,
    onSelect: traceOnSelect,
    enabled: traceNavActive,
  });

  useEffect(() => {
    if (!traceNavActive) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        setTraceNavActive(false);
      }
    }
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [traceNavActive]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Run not found</p>
      </div>
    );
  }

  const duration = (() => {
    if (run.status === "pending") return "\u2014";
    const start = new Date(run.createdAt).getTime();
    const end = run.completedAt
      ? new Date(run.completedAt).getTime()
      : new Date(run.updatedAt).getTime();
    return formatDuration(end - start);
  })();

  const cardOutline = (idx: number) => {
    const props = getItemProps(idx);
    return props["data-keyboard-focused"]
      ? "outline outline-2 outline-orange-500/50 outline-offset-[-2px]"
      : "";
  };

  return (
    <div>
      <Header
        title={`${run.workflowName} \u2014 ${run.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: "Runs", href: "/runs" },
          { label: run.id.slice(0, 8) },
        ]}
      />

      <div className="p-8 space-y-8">
        <Card
          className={cardOutline(statusIdx)}
          ref={getItemProps(statusIdx).ref}
        >
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-lg">Run Status</h2>
              <RunStatusBadge status={run.status} />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-sm text-muted-foreground">Created</span>
                <p className="font-medium mt-0.5">
                  {new Date(run.createdAt).toLocaleString()}
                </p>
              </div>
              {run.completedAt && (
                <div>
                  <span className="text-sm text-muted-foreground">
                    Completed
                  </span>
                  <p className="font-medium mt-0.5">
                    {new Date(run.completedAt).toLocaleString()}
                  </p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Duration</span>
                <p className="font-medium mt-0.5">{duration}</p>
              </div>
              {run.error && (
                <div className="col-span-full">
                  <span className="text-sm text-muted-foreground">Error</span>
                  <p className="font-medium text-destructive mt-0.5">
                    {run.error}
                  </p>
                </div>
              )}
            </div>

            {run.status === "waiting_for_review" && (
              <div className="mt-6">
                <Button
                  asChild
                  className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href={`/review/${run.id}`}>Go to Review</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {workflow && (() => {
          return (
            <Card
              className={cardOutline(progressIdx)}
              ref={getItemProps(progressIdx).ref}
            >
              <CardHeader className="px-6 pt-6 pb-4">
                <h2 className="font-heading text-lg">Step Progress</h2>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <RunProgress run={run} steps={workflow.steps} />
              </CardContent>
            </Card>
          );
        })()}

        {run.tokenUsage && (
          <Card
            className={cardOutline(tokenIdx)}
            ref={getItemProps(tokenIdx).ref}
          >
            <CardHeader className="px-6 pt-6 pb-4">
              <h2 className="font-heading text-lg">Token Usage</h2>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total Tokens</span>
                  <p className="font-medium mt-0.5 tabular-nums">
                    {run.tokenUsage.total.totalTokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Prompt</span>
                  <p className="font-medium mt-0.5 tabular-nums">
                    {run.tokenUsage.total.promptTokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Completion</span>
                  <p className="font-medium mt-0.5 tabular-nums">
                    {run.tokenUsage.total.completionTokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Estimated Cost</span>
                  <p className="font-medium mt-0.5 tabular-nums">
                    ${run.tokenUsage.estimatedCostUsd < 0.01
                      ? run.tokenUsage.estimatedCostUsd.toFixed(4)
                      : run.tokenUsage.estimatedCostUsd.toFixed(2)}
                  </p>
                </div>
              </div>

              {Object.keys(run.tokenUsage.byStep).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <span className="text-sm font-heading text-muted-foreground">Per Step</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(run.tokenUsage.byStep).map(([stepId, usage]) => {
                      const stepDef = workflow?.steps.find((s) => s.id === stepId);
                      return (
                        <div key={stepId} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">
                            {stepDef?.name ?? stepId.slice(0, 8)}
                          </span>
                          <span className="tabular-nums font-mono text-xs text-muted-foreground/60">
                            {usage.totalTokens.toLocaleString()} tok
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(() => {
          const agentCompleteEvents = events.filter((e) => e.type === "agent_complete");
          if (agentCompleteEvents.length === 0) return null;

          const totalIterations = agentCompleteEvents.reduce(
            (sum, e) => sum + ((e.data.totalIterations as number) ?? 0), 0
          );
          const stopReasons = agentCompleteEvents
            .map((e) => e.data.stopReason as string)
            .filter(Boolean);

          const toolCallEvents = events.filter((e) => e.type === "agent_tool_call");
          const toolCounts: Record<string, number> = {};
          for (const e of toolCallEvents) {
            const name = (e.data.toolName as string) ?? "unknown";
            toolCounts[name] = (toolCounts[name] ?? 0) + 1;
          }

          return (
            <Card
              className={cardOutline(agentIdx)}
              ref={getItemProps(agentIdx).ref}
            >
              <CardHeader className="px-6 pt-6 pb-4">
                <h2 className="font-heading text-lg">Agent Summary</h2>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <span className="text-sm text-muted-foreground">Total Iterations</span>
                    <p className="font-medium mt-0.5 tabular-nums">{totalIterations}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Stop Reason</span>
                    <p className="font-medium mt-0.5">{stopReasons.join(", ") || "\u2014"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tool Calls</span>
                    <p className="font-medium mt-0.5 tabular-nums">{toolCallEvents.length}</p>
                  </div>
                </div>

                {Object.keys(toolCounts).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <span className="text-sm font-heading text-muted-foreground">Tools Used</span>
                    <div className="mt-2 space-y-1">
                      {Object.entries(toolCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-mono text-xs">{name}</span>
                            <span className="tabular-nums text-xs text-muted-foreground/60">{count}x</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <Card
          className={cardOutline(traceIdx)}
          ref={getItemProps(traceIdx).ref}
        >
          <CardHeader className="px-6 pt-6 pb-4">
            <h2 className="font-heading text-lg">Trace Timeline</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <TraceTimeline
              events={events}
              kbFocusedIndex={traceNavActive ? traceFocusedIndex : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
