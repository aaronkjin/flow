"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunStatusBadge } from "./run-status-badge";
import type { Run } from "@/lib/engine/types";

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

export function RunListTable({ runs }: { runs: Run[] }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-heading">Workflow Name</TableHead>
          <TableHead className="font-heading">Status</TableHead>
          <TableHead className="font-heading">Started</TableHead>
          <TableHead className="font-heading">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
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
  );
}
