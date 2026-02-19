"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save, Play, LayoutGrid, Trash2, Loader2, BoxSelect, Plus } from "lucide-react";
import type { UseWorkflowReturn } from "./hooks/use-workflow";
import type { WorkflowBlockField, WorkflowBlockConfig } from "@/lib/engine/types";
import { RunDialog } from "./run-dialog";

interface ToolbarProps {
  workflow: UseWorkflowReturn;
}

export function Toolbar({ workflow }: ToolbarProps): React.JSX.Element {
  const router = useRouter();
  const [runDialogOpen, setRunDialogOpen] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [blockName, setBlockName] = useState("");
  const [blockDescription, setBlockDescription] = useState("");
  const [blockFields, setBlockFields] = useState<WorkflowBlockField[]>([]);
  const [outputStepId, setOutputStepId] = useState("");
  const [isSavingBlock, setIsSavingBlock] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!exportOpen) return;
    if (workflow.workflowId) {
      fetch(`/api/workflows/${workflow.workflowId}`)
        .then((res) => res.json())
        .then((data) => {
          const bc = data.workflow?.blockConfig as WorkflowBlockConfig | undefined;
          if (bc) {
            setBlockName(bc.blockName);
            setBlockDescription(bc.blockDescription);
            setBlockFields(bc.inputSchema);
            setOutputStepId(bc.outputStepId);
          }
        })
        .catch(() => {});
    }
  }, [exportOpen, workflow.workflowId]);

  const handleExportSave = useCallback(async () => {
    if (!blockName.trim()) {
      setExportError("Block name is required");
      return;
    }
    setExportError(null);
    setIsSavingBlock(true);
    try {
      await workflow.saveWorkflow();

      const wfId = workflow.workflowId;
      if (!wfId) throw new Error("Workflow must be saved first");

      const blockConfig: WorkflowBlockConfig = {
        blockName: blockName.trim(),
        blockDescription: blockDescription.trim(),
        inputSchema: blockFields,
        outputStepId,
      };

      const res = await fetch(`/api/workflows/${wfId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockConfig }),
      });
      if (!res.ok) throw new Error("Failed to save block config");

      setExportOpen(false);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setIsSavingBlock(false);
    }
  }, [blockName, blockDescription, blockFields, outputStepId, workflow]);

  return (
    <div className="border-b bg-background flex items-center gap-3 px-6 py-[13px]">
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

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={workflow.autoLayout}
      >
        <LayoutGrid className="size-4 mr-1.5" />
        Auto-layout
      </Button>

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

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <BoxSelect className="size-4 mr-1.5" />
            Export as Block
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export as Block</DialogTitle>
            <DialogDescription>
              Export this workflow as a reusable block that other workflows can call.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-heading">Block Name *</Label>
              <Input
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="e.g. Email Classifier"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-heading">Description</Label>
              <Textarea
                rows={2}
                value={blockDescription}
                onChange={(e) => setBlockDescription(e.target.value)}
                placeholder="What does this block do?"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-heading">Input Fields</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setBlockFields([
                      ...blockFields,
                      { name: "", type: "string", required: true },
                    ])
                  }
                >
                  <Plus className="size-3 mr-1" /> Add
                </Button>
              </div>
              {blockFields.map((field, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-border/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground/60">
                      Field {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBlockFields(blockFields.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <Input
                    value={field.name}
                    onChange={(e) => {
                      const updated = [...blockFields];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setBlockFields(updated);
                    }}
                    placeholder="Field name"
                  />
                  <div className="flex items-center gap-2">
                    <Select
                      value={field.type}
                      onValueChange={(v) => {
                        const updated = [...blockFields];
                        updated[i] = {
                          ...updated[i],
                          type: v as WorkflowBlockField["type"],
                        };
                        setBlockFields(updated);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label className="text-xs">Required</Label>
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => {
                          const updated = [...blockFields];
                          updated[i] = {
                            ...updated[i],
                            required: checked === true,
                          };
                          setBlockFields(updated);
                        }}
                      />
                    </div>
                  </div>
                  <Input
                    value={field.description ?? ""}
                    onChange={(e) => {
                      const updated = [...blockFields];
                      updated[i] = {
                        ...updated[i],
                        description: e.target.value || undefined,
                      };
                      setBlockFields(updated);
                    }}
                    placeholder="Description (optional)"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-heading">Output Step</Label>
              <Select
                value={outputStepId}
                onValueChange={setOutputStepId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select output step..." />
                </SelectTrigger>
                <SelectContent>
                  {workflow.nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.data.label} ({node.data.stepType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground/60">
                Which step&apos;s output becomes the block&apos;s return value
              </p>
            </div>

            {exportError && (
              <p className="text-sm text-destructive">{exportError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleExportSave}
              disabled={isSavingBlock}
              className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSavingBlock && (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              )}
              Save Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
        onClick={() => setRunDialogOpen(true)}
      >
        <Play className="size-4 mr-1.5" />
        Run
      </Button>
      <RunDialog
        open={runDialogOpen}
        onOpenChange={setRunDialogOpen}
        workflowId={workflow.workflowId}
        onRun={async (input) => {
          const runId = await workflow.runWorkflow(input);
          router.push(`/runs/${runId}`);
        }}
      />
    </div>
  );
}
