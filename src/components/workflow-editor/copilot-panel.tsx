"use client";

import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Send,
  Loader2,
  Check,
  AlertTriangle,
  Plus,
  Minus,
  Pencil,
  ArrowRight,
  X,
  Paperclip,
  FileText,
  Image,
  FileIcon,
} from "lucide-react";
import type { CopilotArtifactRef } from "@/lib/workflow-copilot/artifact-types";
import type { UseWorkflowReturn } from "./hooks/use-workflow";
import type {
  CopilotMessage,
  CopilotGenerateResponse,
  CopilotRefineResponse,
  CopilotOperation,
  CopilotOperationAuditEntry,
  CopilotDiffSummary,
} from "@/lib/workflow-copilot/types";

interface CopilotPanelProps {
  workflow: UseWorkflowReturn;
}

export function CopilotPanel({ workflow }: CopilotPanelProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const [artifacts, setArtifacts] = useState<CopilotArtifactRef[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function shouldRefine(): boolean {
    const snapshot = workflow.getWorkflowSnapshot();
    return snapshot !== null && snapshot.steps.length > 0;
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/workflows/copilot/upload-artifact", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const { artifact } = (await res.json()) as {
            artifact: CopilotArtifactRef;
          };
          setArtifacts((prev) => [...prev, artifact]);
        }
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeArtifact(id: string) {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    const isRefine = shouldRefine();

    const userMessage: CopilotMessage = {
      id: uuidv4(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const artifactIds = artifacts.map((a) => a.id);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setArtifacts([]);
    setIsGenerating(true);
    workflow.setPreview(null, null);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      if (isRefine) {
        await handleRefine(trimmed, conversationHistory);
      } else {
        await handleGenerate(trimmed, conversationHistory, artifactIds);
      }
    } catch (err) {
      const errorMessage: CopilotMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Request failed"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate(
    message: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
    artifactIds?: string[],
  ) {
    const res = await fetch("/api/workflows/generate-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversationHistory,
        ...(artifactIds && artifactIds.length > 0 ? { artifactIds } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Generation failed" }));
      throw new Error(err.error || "Generation failed");
    }

    const result: CopilotGenerateResponse = await res.json();

    const assistantMessage: CopilotMessage = {
      id: uuidv4(),
      role: "assistant",
      content: result.validation.ok
        ? `Generated "${result.draft.title}" with ${result.draft.steps.length} steps and ${result.draft.edges.length} edges.`
        : `Generated draft has validation errors that could not be auto-repaired.`,
      draft: result.draft,
      validation: result.validation,
      compiledPreview: result.compiledPreview,
      messageType: "generate",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    if (result.validation.ok && result.compiledPreview) {
      workflow.setPreview(
        result.compiledPreview.nodes,
        result.compiledPreview.edges,
      );
    }
  }

  async function handleRefine(
    message: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  ) {
    const snapshot = workflow.getWorkflowSnapshot();
    if (!snapshot) throw new Error("No workflow to refine");

    const res = await fetch("/api/workflows/refine-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversationHistory,
        currentWorkflow: snapshot,
      }),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Refinement failed" }));
      throw new Error(err.error || "Refinement failed");
    }

    const result: CopilotRefineResponse = await res.json();

    const appliedCount = result.audit.filter(
      (a) => a.status === "applied",
    ).length;
    const rejectedCount = result.audit.filter(
      (a) => a.status === "rejected",
    ).length;

    let summary = `Refined workflow: ${appliedCount} operation${appliedCount !== 1 ? "s" : ""} applied`;
    if (rejectedCount > 0) {
      summary += `, ${rejectedCount} rejected`;
    }
    summary += ".";

    const assistantMessage: CopilotMessage = {
      id: uuidv4(),
      role: "assistant",
      content: summary,
      draft: result.nextDraft,
      validation: result.validation,
      compiledPreview: result.compiledPreview,
      messageType: "refine",
      operations: result.operations,
      audit: result.audit,
      diffSummary: result.diffSummary,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    if (result.validation.ok && result.compiledPreview) {
      workflow.setPreview(
        result.compiledPreview.nodes,
        result.compiledPreview.edges,
      );
    }
  }

  function handleApply(message: CopilotMessage) {
    if (!message.compiledPreview) return;
    workflow.setPreview(null, null);
    workflow.replaceWorkflowGraph(message.compiledPreview);
    setAppliedIds((prev) => new Set([...prev, message.id]));
  }

  function handleDiscard(message: CopilotMessage) {
    workflow.setPreview(null, null);
    setDiscardedIds((prev) => new Set([...prev, message.id]));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isRefineMode = shouldRefine();

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !isGenerating ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bot className="size-4 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-heading text-muted-foreground/90">
              Put a workflow into{" "}
              <span className="font-heading italic">Flow</span>
            </p>
            <p className="text-xs text-muted-foreground/40 mt-2">
              e.g. &ldquo;Triage support tickets, score urgency, notify
              Slack&rdquo;
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-muted/50 rounded-lg p-3 max-w-[240px]">
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs text-muted-foreground/40 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="rounded-lg p-3 border border-border/40 max-w-[260px]">
                      {msg.messageType && (
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/50 mb-1 font-medium">
                          {msg.messageType === "refine"
                            ? "Refined draft"
                            : "Generated draft"}
                        </p>
                      )}

                      <p className="text-sm">{msg.content}</p>

                      {msg.messageType === "refine" && msg.audit && (
                        <div className="mt-2 space-y-1.5">
                          <OperationsList audit={msg.audit} />
                          {msg.diffSummary && (
                            <DiffSummaryChips diff={msg.diffSummary} />
                          )}
                        </div>
                      )}
                      {msg.draft && msg.messageType !== "refine" && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-xs text-muted-foreground/60">
                            {msg.draft.steps.length} steps,{" "}
                            {msg.draft.edges.length} edges
                          </p>
                          {msg.draft.assumptions &&
                            msg.draft.assumptions.length > 0 && (
                              <div className="text-xs text-muted-foreground/60">
                                {msg.draft.assumptions.map((a, i) => (
                                  <p key={i} className="mt-0.5">
                                    &bull; {a}
                                  </p>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                      {msg.validation && msg.validation.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.validation.warnings.map((w, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-1 text-xs"
                            >
                              <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.validation && msg.validation.errors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.validation.errors.map((e, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded px-2 py-1 text-xs"
                            >
                              <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                              <span>{e}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.validation?.ok && msg.compiledPreview && (
                        <div className="mt-2">
                          {appliedIds.has(msg.id) ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                              <Check className="size-3" />
                              <span>Applied!</span>
                            </div>
                          ) : discardedIds.has(msg.id) ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                              <X className="size-3" />
                              <span>Discarded</span>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-heading"
                                onClick={() => handleApply(msg)}
                              >
                                Apply Changes
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground"
                                onClick={() => handleDiscard(msg)}
                              >
                                Discard
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground/40 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="rounded-lg p-3 border border-border/40">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>
                      {isRefineMode
                        ? "Refining workflow..."
                        : "Generating workflow..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="p-3 border-t border-border/40 space-y-2 shrink-0">
        {artifacts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {artifacts.map((a) => (
              <ArtifactChip key={a.id} artifact={a} onRemove={removeArtifact} />
            ))}
          </div>
        )}

        <div className="relative">
          <Textarea
            className="bg-muted/50 border-transparent focus-visible:border-ring focus-visible:bg-background transition-colors text-sm resize-none pr-9"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRefineMode
                ? "Add HITL after judge, Replace email with Slack..."
                : "Describe your intent. Build any workflow..."
            }
            disabled={isGenerating}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.md,.html,.json,.xml,.yaml,.yml"
            multiple
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="absolute right-2 bottom-2 p-1 rounded hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating || isUploading}
            title="Attach files"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
          </button>
        </div>

        <Button
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-heading text-sm"
          onClick={handleSend}
          disabled={isGenerating || input.trim() === ""}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              {isRefineMode ? "Refining..." : "Generating..."}
            </>
          ) : (
            <>
              <Send className="size-3.5 mr-1.5" />
              {isRefineMode ? "Refine" : "Generate"}
              {artifacts.length > 0 && (
                <span className="ml-1 text-white/70">
                  ({artifacts.length} file{artifacts.length > 1 ? "s" : ""})
                </span>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
function OperationsList({ audit }: { audit: CopilotOperationAuditEntry[] }) {
  if (audit.length === 0) return null;

  return (
    <div className="space-y-1">
      {audit.map((entry, i) => (
        <div
          key={i}
          className={`flex items-start gap-1.5 text-xs rounded px-2 py-1 ${
            entry.status === "applied"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-600 border border-rose-200"
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {entry.status === "applied" ? (
              <OpIcon op={entry.op} />
            ) : (
              <X className="size-3" />
            )}
          </span>
          <span>
            {describeOp(entry.op)}
            {entry.reason && (
              <span className="text-rose-500 ml-1">— {entry.reason}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function OpIcon({ op }: { op: CopilotOperation }) {
  switch (op.op) {
    case "add_step":
    case "add_edge":
      return <Plus className="size-3" />;
    case "remove_step":
    case "remove_edge":
      return <Minus className="size-3" />;
    case "update_step_config":
    case "rename_step":
      return <Pencil className="size-3" />;
    default:
      return <ArrowRight className="size-3" />;
  }
}

function describeOp(op: CopilotOperation): string {
  switch (op.op) {
    case "add_step":
      return `Add step "${op.step.name}" (${op.step.type})${op.afterStepId ? ` after ${op.afterStepId}` : ""}`;
    case "remove_step":
      return `Remove step "${op.stepId}"`;
    case "update_step_config":
      return `Update config of "${op.stepId}"`;
    case "rename_step":
      return `Rename "${op.stepId}" to "${op.name}"`;
    case "add_edge":
      return `Add edge ${op.source} → ${op.target}${op.label ? ` [${op.label}]` : ""}`;
    case "remove_edge":
      return `Remove edge ${op.source} → ${op.target}`;
  }
}

function ArtifactChip({
  artifact,
  onRemove,
}: {
  artifact: CopilotArtifactRef;
  onRemove: (id: string) => void;
}) {
  const isImage = artifact.mimeType.startsWith("image/");
  const isPdf = artifact.mimeType === "application/pdf";
  const Icon = isImage ? Image : isPdf ? FileText : FileIcon;
  const sizeLabel =
    artifact.sizeBytes < 1024
      ? `${artifact.sizeBytes} B`
      : artifact.sizeBytes < 1024 * 1024
        ? `${(artifact.sizeBytes / 1024).toFixed(0)} KB`
        : `${(artifact.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <span className="inline-flex items-center gap-1 bg-muted/60 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground max-w-[180px]">
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{artifact.name}</span>
      <span className="text-muted-foreground/40 shrink-0">{sizeLabel}</span>
      <button
        type="button"
        className="shrink-0 hover:text-foreground"
        onClick={() => onRemove(artifact.id)}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function DiffSummaryChips({ diff }: { diff: CopilotDiffSummary }) {
  const chips: Array<{ label: string; color: string }> = [];

  if (diff.stepsAdded > 0)
    chips.push({
      label: `+${diff.stepsAdded} step${diff.stepsAdded > 1 ? "s" : ""}`,
      color: "bg-emerald-100 text-emerald-700",
    });
  if (diff.stepsRemoved > 0)
    chips.push({
      label: `-${diff.stepsRemoved} step${diff.stepsRemoved > 1 ? "s" : ""}`,
      color: "bg-rose-100 text-rose-700",
    });
  if (diff.stepsUpdated > 0)
    chips.push({
      label: `~${diff.stepsUpdated} step${diff.stepsUpdated > 1 ? "s" : ""}`,
      color: "bg-blue-100 text-blue-700",
    });
  if (diff.edgesAdded > 0)
    chips.push({
      label: `+${diff.edgesAdded} edge${diff.edgesAdded > 1 ? "s" : ""}`,
      color: "bg-emerald-100 text-emerald-700",
    });
  if (diff.edgesRemoved > 0)
    chips.push({
      label: `-${diff.edgesRemoved} edge${diff.edgesRemoved > 1 ? "s" : ""}`,
      color: "bg-rose-100 text-rose-700",
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip, i) => (
        <span
          key={i}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${chip.color}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
