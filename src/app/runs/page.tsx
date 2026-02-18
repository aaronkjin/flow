"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useZoneNav } from "@/hooks/use-zone-nav";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play } from "lucide-react";
import { RunListTable } from "@/components/run/run-list-table";
import type { Run, WorkflowDefinition } from "@/lib/engine/types";

export default function RunsPage() {
  const router = useRouter();
  const { setZones, activeZone, isLocked } = useZoneNav();
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setZones(["sidebar", "content"]);
  }, [setZones]);

  const isContentActive = activeZone === "content";

  const fetchData = useCallback(async () => {
    try {
      const [runsRes, wfRes] = await Promise.all([
        fetch("/api/runs"),
        fetch("/api/workflows"),
      ]);
      if (runsRes.ok) {
        const { runs } = (await runsRes.json()) as { runs: Run[] };
        setRuns(runs ?? []);
      }
      if (wfRes.ok) {
        const { workflows } = (await wfRes.json()) as { workflows: WorkflowDefinition[] };
        setWorkflows(workflows ?? []);
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

  const filteredRuns = useMemo(
    () =>
      selectedWorkflowId === "all"
        ? runs
        : runs.filter((r) => r.workflowId === selectedWorkflowId),
    [runs, selectedWorkflowId],
  );

  const { getItemProps } = useKeyboardNav({
    itemCount: filteredRuns.length,
    onSelect: (index) => router.push(`/runs/${filteredRuns[index].id}`),
    enabled: isContentActive,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const contentZoneOutline = isContentActive
    ? isLocked
      ? "outline outline-2 outline-orange-500/80 outline-offset-[-2px] rounded-lg"
      : "outline outline-2 outline-orange-500/50 outline-offset-[-2px] rounded-lg"
    : "";

  return (
    <div>
      <Header title="Runs" />
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {workflows.map((wf) => (
                <SelectItem key={wf.id} value={wf.id}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="flex items-center gap-5 p-8">
            <Play className="size-10 text-muted-foreground/40 shrink-0" />
            <div>
              <h2 className="font-heading text-lg">No runs found</h2>
              <p className="text-muted-foreground mt-1">
                Put a workflow into <span className="font-heading italic">Action</span>.
              </p>
            </div>
          </div>
        ) : (
          <Card className={contentZoneOutline}>
            <RunListTable runs={filteredRuns} getItemProps={getItemProps} />
          </Card>
        )}
      </div>
    </div>
  );
}
