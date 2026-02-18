"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Workflow } from "lucide-react";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  steps: { id: string }[];
  updatedAt: string;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const { workflows } = (await res.json()) as { workflows: WorkflowSummary[] };
        setWorkflows(workflows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    const interval = setInterval(fetchWorkflows, 15000);
    const onFocus = () => fetchWorkflows();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchWorkflows]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this workflow?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    fetchWorkflows();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Workflows"
        actions={
          <Button
            className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => router.push("/workflows/new")}
          >
            <Plus className="size-4 mr-1.5" />
            New Workflow
          </Button>
        }
      />
      <div className="p-8 space-y-6">
        {workflows.length === 0 ? (
          <div className="flex items-center gap-5 p-8">
            <Workflow className="size-10 text-muted-foreground/40 shrink-0" />
            <div>
              <h2 className="font-heading text-lg">No workflows yet</h2>
              <p className="text-muted-foreground mt-1">
                Create your first workflow and put it into <span className="font-heading italic">Action</span>.
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-heading">Name</TableHead>
                  <TableHead className="font-heading">Description</TableHead>
                  <TableHead className="font-heading text-center">Steps</TableHead>
                  <TableHead className="font-heading">Last Updated</TableHead>
                  <TableHead className="font-heading w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((wf) => (
                  <TableRow
                    key={wf.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => router.push(`/workflows/${wf.id}`)}
                  >
                    <TableCell className="font-medium py-5">{wf.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate py-5">
                      {wf.description || "\u2014"}
                    </TableCell>
                    <TableCell className="text-center py-5">
                      {wf.steps?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground/70 py-5">
                      {new Date(wf.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/workflows/${wf.id}`);
                            }}
                          >
                            <Pencil className="size-4 mr-2" />
                            Edit workflow
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(wf.id);
                            }}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete workflow
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
