"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ReviewItem } from "@/lib/engine/types";
import type { HITLStepConfig } from "@/lib/engine/types";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, UserCheck } from "lucide-react";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function recommendationBadge(rec: "pass" | "flag" | "fail") {
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

export default function ReviewQueuePage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/review");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    const interval = setInterval(fetchReviews, 5000);
    const onFocus = () => fetchReviews();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchReviews]);

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
        title="Review Queue"
        badge={
          reviews.length > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {reviews.length} pending
            </Badge>
          ) : undefined
        }
      />
      <div className="p-8 space-y-6">
        {reviews.length === 0 ? (
          <div className="flex items-center gap-5 p-8">
            <UserCheck className="size-10 text-muted-foreground/40 shrink-0" />
            <div>
              <h2 className="font-heading text-lg">No pending reviews</h2>
              <p className="text-muted-foreground mt-1">
                When a workflow pauses for human review, it is time for you to
                take <span className="font-heading italic">Action</span>.
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-heading">Workflow</TableHead>
                  <TableHead className="font-heading">Run ID</TableHead>
                  <TableHead className="font-heading">Step</TableHead>
                  <TableHead className="font-heading">Instructions</TableHead>
                  <TableHead className="font-heading">Waiting</TableHead>
                  <TableHead className="font-heading">Judge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => {
                  const config = review.currentStep.config as HITLStepConfig;
                  const instructions = config.instructions || "";
                  return (
                    <TableRow
                      key={review.run.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/review/${review.run.id}`)}
                    >
                      <TableCell className="font-medium py-5">
                        {review.workflowName}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs py-5">
                        {review.run.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="py-5">
                        {review.currentStep.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate py-5">
                        {instructions.length > 100
                          ? instructions.slice(0, 100) + "\u2026"
                          : instructions}
                      </TableCell>
                      <TableCell className="text-muted-foreground/70 whitespace-nowrap py-5">
                        {formatTimeAgo(review.run.createdAt)}
                      </TableCell>
                      <TableCell className="py-5">
                        {review.judgeAssessment ? (
                          recommendationBadge(
                            review.judgeAssessment.recommendation,
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {"\u2014"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
