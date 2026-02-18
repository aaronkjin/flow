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

interface RunListTableProps {
  runs: Run[];
  getItemProps?: (index: number) => {
    "data-focused": boolean;
    "data-keyboard-focused": boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
    ref: (el: HTMLElement | null) => void;
  };
}

export function RunListTable({ runs, getItemProps }: RunListTableProps) {
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
        {runs.map((run, index) => {
          const itemProps = getItemProps?.(index);
          const isKbFocused = itemProps?.["data-keyboard-focused"] ?? false;
          return (
          <TableRow
            key={run.id}
            className={`cursor-pointer ${isKbFocused ? "bg-orange-500/[0.06] outline outline-2 outline-orange-500/50 outline-offset-[-2px] rounded-md hover:bg-orange-500/[0.06]" : ""}`}
            ref={itemProps?.ref}
            onMouseEnter={itemProps?.onMouseEnter}
            onMouseLeave={itemProps?.onMouseLeave}
            onClick={itemProps?.onClick ?? (() => router.push(`/runs/${run.id}`))}
          >
            <TableCell className={`font-medium py-5 ${isKbFocused ? "text-orange-900/90" : ""}`}>
              {run.workflowName}
            </TableCell>
            <TableCell className="py-5">
              <RunStatusBadge status={run.status} />
            </TableCell>
            <TableCell className={`py-5 ${isKbFocused ? "text-orange-800/70" : "text-muted-foreground/70"}`}>
              {new Date(run.createdAt).toLocaleString()}
            </TableCell>
            <TableCell className={`py-5 ${isKbFocused ? "text-orange-800/70" : "text-muted-foreground/70"}`}>
              {getDuration(run)}
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
