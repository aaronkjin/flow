"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save, Play, LayoutGrid, Trash2, Loader2 } from "lucide-react";
import type { UseWorkflowReturn } from "./hooks/use-workflow";

interface ToolbarProps {
  workflow: UseWorkflowReturn;
}

export function Toolbar({ workflow }: ToolbarProps): React.JSX.Element {
  const router = useRouter();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runInput, setRunInput] = useState("{}");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const handleNameBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      workflow.setWorkflowName(e.target.value);
    },
    [workflow],
  );

  const handleDescriptionBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      workflow.setWorkflowDescription(e.target.value);
    },
    [workflow],
  );

  const handleRun = useCallback(async () => {
    setRunError(null);
    setIsRunning(true);
    try {
      const parsed = JSON.parse(runInput);
      const runId = await workflow.runWorkflow(parsed);
      setRunDialogOpen(false);
      router.push(`/runs/${runId}`);
    } catch (err) {
      setRunError(
        err instanceof SyntaxError
          ? "Invalid JSON input"
          : err instanceof Error
            ? err.message
            : "Failed to start run",
      );
    } finally {
      setIsRunning(false);
    }
  }, [runInput, workflow, router]);

  return (
    <div className="border-b bg-background flex items-center gap-3 px-6 py-[13px]">
      {/* Workflow name + description — borderless inline editing */}
      <div className="flex flex-col gap-0.5">
        <input
          className="font-heading text-base bg-transparent outline-none placeholder:text-muted-foreground/40 w-64"
          defaultValue={workflow.workflowName}
          onBlur={handleNameBlur}
          placeholder="Untitled Workflow"
        />
        <input
          className="text-sm text-muted-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 w-64"
          defaultValue={workflow.workflowDescription}
          onBlur={handleDescriptionBlur}
          placeholder="Add a description..."
        />
      </div>

      <div className="flex-1" />

      {/* Auto-layout */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={workflow.autoLayout}
      >
        <LayoutGrid className="size-4 mr-1.5" />
        Auto-layout
      </Button>

      {/* Delete selected */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={workflow.deleteSelected}
        disabled={!workflow.selectedNodeId}
      >
        <Trash2 className="size-4 mr-1.5" />
        Delete
      </Button>

      {/* Save */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => workflow.saveWorkflow()}
        disabled={!workflow.isDirty || workflow.isSaving}
      >
        {workflow.isSaving ? (
          <Loader2 className="size-4 mr-1.5 animate-spin" />
        ) : (
          <Save className="size-4 mr-1.5" />
        )}
        Save
      </Button>

      {/* Run — accent color + Baskerville font */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Play className="size-4 mr-1.5" />
            Run
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Workflow</DialogTitle>
            <DialogDescription>
              Provide JSON input for the workflow run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Input JSON</Label>
            <Textarea
              rows={8}
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder="{}"
              className="font-mono text-sm"
            />
            {runError && <p className="text-sm text-destructive">{runError}</p>}
          </div>
          <DialogFooter>
            <Button
              onClick={handleRun}
              disabled={isRunning}
              className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isRunning ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="size-4 mr-1.5" />
              )}
              Start Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
