"use client";

import { useState } from "react";
import type { JudgeResult } from "@/lib/engine/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";

interface JudgeAssessmentProps {
  assessment: JudgeResult;
  cardProps?: {
    "data-keyboard-focused": boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    ref: (el: HTMLElement | null) => void;
  };
}

function recommendationBadge(rec: JudgeResult["recommendation"]) {
  switch (rec) {
    case "pass":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-600 border-emerald-200"
        >
          Pass
        </Badge>
      );
    case "flag":
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-600 border-amber-200"
        >
          Flagged
        </Badge>
      );
    case "fail":
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-600 border-rose-200"
        >
          Fail
        </Badge>
      );
  }
}

function confidenceColor(value: number) {
  if (value > 0.8) return "bg-emerald-400";
  if (value >= 0.5) return "bg-amber-400";
  return "bg-rose-400";
}

export function JudgeAssessment({ assessment, cardProps }: JudgeAssessmentProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const sortedCriteria = Object.entries(assessment.criteriaScores).sort(
    ([, a], [, b]) => a - b,
  );

  return (
    <Card
      className={cardProps?.["data-keyboard-focused"] ? "outline outline-2 outline-orange-500/50 outline-offset-[-2px]" : ""}
      ref={cardProps?.ref}
    >
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg">Judge Assessment</h2>
          {recommendationBadge(assessment.recommendation)}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Confidence</span>
            <span className="font-medium">
              {Math.round(assessment.overallConfidence * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${confidenceColor(assessment.overallConfidence)}`}
              style={{
                width: `${assessment.overallConfidence * 100}%`,
              }}
            />
          </div>
        </div>

        {sortedCriteria.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Criteria Scores</h4>
            {sortedCriteria.map(([name, score]) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-medium">
                    {Math.round(score * 100)}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${confidenceColor(score)}`}
                    style={{ width: `${score * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {assessment.issues.length > 0 && (
          <div className="rounded-lg border-l-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 space-y-1">
            <h4 className="text-sm font-medium">Issues</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {assessment.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:underline cursor-pointer">
            {reasoningOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            Reasoning
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-lg border border-muted-foreground/25 bg-muted/40 p-4 flex gap-2">
              <Sparkles className="size-4 text-stone-600 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground/80 whitespace-pre-wrap">
                {assessment.reasoning}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
