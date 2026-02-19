"use client";

import { useState, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import type { ReviewItem, HITLStepConfig } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { JudgeAssessment } from "./judge-assessment";
import { OutputEditor } from "./output-editor";

interface CardProps {
  "data-keyboard-focused": boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  ref: (el: HTMLElement | null) => void;
}

export interface ReviewPanelHandle {
  approve: () => void;
}

interface ReviewPanelProps {
  review: ReviewItem;
  getCardProps?: (index: number) => CardProps;
  actionRef?: React.Ref<ReviewPanelHandle>;
}

export function ReviewPanel({ review, getCardProps, actionRef }: ReviewPanelProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);

  const config = review.currentStep.config as HITLStepConfig;
  const reviewTargetStepId = config.reviewTargetStepId;

  const outputEntries = Object.entries(review.priorStepOutputs);
  const primaryStepId =
    reviewTargetStepId && review.priorStepOutputs[reviewTargetStepId]
      ? reviewTargetStepId
      : outputEntries[0]?.[0];
  const primaryOutput = primaryStepId
    ? review.priorStepOutputs[primaryStepId]
    : null;

  async function submitDecision(
    action: "approve" | "edit" | "reject",
    editedOutput?: Record<string, unknown>
  ) {
    setSubmitting(true);
    setError(null);
    try {
      const targetStepId =
        reviewTargetStepId && review.priorStepOutputs[reviewTargetStepId]
          ? reviewTargetStepId
          : primaryStepId;

      if (action === "edit" && !targetStepId) {
        setError("No step output available to edit.");
        setSubmitting(false);
        return;
      }

      const res = await fetch(`/api/review/${review.run.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          editedOutput,
          comment: comment || undefined,
          targetStepId: targetStepId ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit decision");
        return;
      }
      router.push(`/runs/${review.run.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleApprove() {
    submitDecision("approve");
  }

  useImperativeHandle(actionRef, () => ({
    approve: handleApprove,
  }));

  function handleEditApprove() {
    setEditing(true);
  }

  function handleEditConfirm(editedOutput: Record<string, unknown>) {
    setEditing(false);
    submitDecision("edit", editedOutput);
  }

  function handleReject() {
    setRejectDialogOpen(true);
  }

  function confirmReject() {
    setRejectDialogOpen(false);
    submitDecision("reject");
  }

  const hasJudge = !!review.judgeAssessment;

  return (
    <div className="space-y-8">
      <div
        className={`grid gap-6 ${hasJudge ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}
      >
        <Card
          className={getCardProps?.(0)?.["data-keyboard-focused"] ? "outline outline-2 outline-orange-500/50 outline-offset-[-2px]" : ""}
          ref={getCardProps?.(0)?.ref}
        >
          <CardHeader className="px-6 pt-6 pb-4">
            <h2 className="font-heading text-lg">Output to Review</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            {config.instructions && (
              <div className="rounded-lg border-l-2 border-muted-foreground/20 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                {config.instructions}
              </div>
            )}

            {editing && primaryOutput ? (
              <OutputEditor
                initialOutput={primaryOutput}
                onConfirm={handleEditConfirm}
                onCancel={() => setEditing(false)}
              />
            ) : (
              outputEntries.map(([stepId, output]) => {
                const isPrimary = stepId === primaryStepId;
                return (
                  <div
                    key={stepId}
                    className={`rounded-lg border p-4 space-y-1.5 ${isPrimary ? "border-sky-200/60 bg-sky-50/30" : ""}`}
                  >
                    <h4 className="text-sm font-medium">
                      {stepId}
                      {isPrimary && (
                        <span className="ml-2 text-xs text-sky-500">
                          Primary
                        </span>
                      )}
                    </h4>
                    <div className="text-sm">
                      {typeof output.result === "string" ? (
                        <p className="whitespace-pre-wrap">{output.result}</p>
                      ) : (
                        <pre className="text-xs bg-muted/30 rounded-lg p-3 overflow-auto max-h-64 font-mono">
                          {JSON.stringify(output, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <Collapsible open={inputOpen} onOpenChange={setInputOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:underline cursor-pointer">
                {inputOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                Workflow Input
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 text-xs bg-muted/30 rounded-lg p-3 overflow-auto max-h-48 font-mono">
                  {JSON.stringify(review.run.input, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {review.judgeAssessment && (
          <JudgeAssessment
            assessment={review.judgeAssessment}
            cardProps={getCardProps?.(1)}
          />
        )}
      </div>

      {(() => {
        const actionIdx = hasJudge ? 2 : 1;
        const actionProps = getCardProps?.(actionIdx);
        return (
      <Card
        className={actionProps?.["data-keyboard-focused"] ? "outline outline-2 outline-orange-500/50 outline-offset-[-2px]" : ""}
        ref={actionProps?.ref}
      >
        <CardContent className="p-6 space-y-4">
          <Textarea
            placeholder="Add a comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApprove}
              disabled={submitting || editing}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : null}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={handleEditApprove}
              disabled={submitting || editing}
            >
              Edit &amp; Approve
            </Button>
            <Button
              variant="ghost"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={handleReject}
              disabled={submitting || editing}
            >
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
        );
      })()}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this output?</DialogTitle>
            <DialogDescription>
              This will fail the workflow run. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
