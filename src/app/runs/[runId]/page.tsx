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

  // Reset trace nav when leaving content zone
  useEffect(() => {
    if (!isContentActive) setTraceNavActive(false);
  }, [isContentActive]);

  const fetchRunData = useCallback(async () => {
    try {
      const [runRes, traceRes] = await Promise.all([
        fetch(`/api/runs/${runId}`),
        fetch(`/api/runs/${runId}/trace`),
      ]);
      if (runRes.ok) {
        const { run } = (await runRes.json()) as { run: Run };
        setRun(run);
        if (run?.workflowId) {
          const wfRes = await fetch(`/api/workflows/${run.workflowId}`);
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
        setEvents(data.events ?? data ?? []);
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

  // Card indices
  const cardCount = workflow ? 3 : 2;
  const statusIdx = 0;
  const progressIdx = workflow ? 1 : -1;
  const traceIdx = workflow ? 2 : 1;

  // Card-level nav: disabled when drilling into trace events
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

  // Trace event-level nav
  const traceOnSelect = useCallback(() => {}, []);
  const { focusedIndex: traceFocusedIndex } = useKeyboardNav({
    itemCount: events.length,
    onSelect: traceOnSelect,
    enabled: traceNavActive,
  });

  // Escape from trace mode: capture phase prevents zone nav from also unlocking
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

  // Card outline: only use data-keyboard-focused (no mouse handlers on cards for sticky focus)
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
        {/* Status section */}
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

        {/* Step progress */}
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

        {/* Trace timeline */}
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
