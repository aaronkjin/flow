"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/run/run-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowRight, Play } from "lucide-react";
import type { Run, WorkflowDefinition } from "@/lib/engine/types";

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

function getDuration(run: Run): string {
  if (run.status === "pending") return "\u2014";
  const start = new Date(run.createdAt).getTime();
  const end = run.completedAt
    ? new Date(run.completedAt).getTime()
    : new Date(run.updatedAt).getTime();
  return formatDuration(end - start);
}

export default function DashboardPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [wfRes, runsRes] = await Promise.all([
        fetch("/api/workflows"),
        fetch("/api/runs"),
      ]);
      if (wfRes.ok) {
        const { workflows } = (await wfRes.json()) as {
          workflows: WorkflowDefinition[];
        };
        setWorkflows(workflows ?? []);
      }
      if (runsRes.ok) {
        const { runs } = (await runsRes.json()) as { runs: Run[] };
        setRuns(runs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 5000);
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const runningRuns = runs.filter((r) => r.status === "running" || r.status === "waiting_for_review").length;
  const pendingReviewCount = runs.filter(
    (r) => r.status === "waiting_for_review",
  ).length;
  const completedRuns = runs.filter((r) => r.status === "completed").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const successRate =
    completedRuns + failedRuns > 0
      ? Math.round((completedRuns / (completedRuns + failedRuns)) * 100)
      : null;

  const recentRuns = [...runs]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 10);

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-8 space-y-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Workflows */}
          <Card>
            <CardContent className="p-6">
              <span className="text-sm font-medium text-muted-foreground">
                Total Workflows
              </span>
              <div className="font-heading text-4xl mt-1">
                {workflows.length}
              </div>
            </CardContent>
          </Card>

          {/* Total Runs */}
          <Card>
            <CardContent className="p-6">
              <span className="text-sm font-medium text-muted-foreground">
                Total Runs
              </span>
              <div className="font-heading text-4xl mt-1">{runs.length}</div>
              <Separator className="my-3" />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Running{" "}
                  <span className="font-medium text-foreground">
                    {runningRuns}
                  </span>
                </span>
                <span>
                  Completed{" "}
                  <span className="font-medium text-foreground">
                    {completedRuns}
                  </span>
                </span>
                <span>
                  Failed{" "}
                  <span className="font-medium text-foreground">
                    {failedRuns}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Pending Reviews */}
          <Card>
            <CardContent className="p-6">
              <span className="text-sm font-medium text-muted-foreground">
                Pending Reviews
              </span>
              <div className="font-heading text-4xl mt-1">
                {pendingReviewCount}
              </div>
            </CardContent>
          </Card>

          {/* Success Rate */}
          <Card>
            <CardContent className="p-6">
              <span className="text-sm font-medium text-muted-foreground">
                Success Rate
              </span>
              <div className="font-heading text-4xl mt-1">
                {successRate !== null ? `${successRate}%` : "\u2014"}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Completed{" "}
                  <span className="font-medium text-foreground">
                    {completedRuns}
                  </span>
                </span>
                <span>
                  Failed{" "}
                  <span className="font-medium text-foreground">
                    {failedRuns}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent runs */}
        {recentRuns.length === 0 ? (
          <div className="flex items-center gap-5 p-8">
            <Play className="size-10 text-muted-foreground/40 shrink-0" />
            <div>
              <h2 className="font-heading text-lg">No runs yet</h2>
              <p className="text-muted-foreground mt-1">
                Put a workflow into{" "}
                <span className="font-heading italic">Action</span>.
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <div className="pl-6 pt-6 pb-4">
              <h2 className="font-heading text-lg">Recent Runs</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-heading">
                    Workflow Name
                  </TableHead>
                  <TableHead className="font-heading">Status</TableHead>
                  <TableHead className="font-heading">Started</TableHead>
                  <TableHead className="font-heading">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => router.push(`/runs/${run.id}`)}
                  >
                    <TableCell className="font-medium py-5">
                      {run.workflowName}
                    </TableCell>
                    <TableCell className="py-5">
                      <RunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground/70 py-5">
                      {new Date(run.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground/70 py-5">
                      {getDuration(run)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Quick actions */}
        <div className="flex gap-4">
          <Button
            variant="ghost"
            className="group font-heading text-sm"
            onClick={() => router.push("/workflows/new")}
          >
            Create Workflow
            <ArrowRight className="size-3.5 ml-1.5 transition-colors group-hover:text-orange-500" />
          </Button>
          <Button
            variant="ghost"
            className="group font-heading text-sm"
            onClick={() => router.push("/review")}
          >
            Review Queue
            <ArrowRight className="size-3.5 ml-1.5 transition-colors group-hover:text-orange-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}
