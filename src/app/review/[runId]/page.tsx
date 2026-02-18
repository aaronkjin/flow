"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useZoneNav } from "@/hooks/use-zone-nav";
import type { ReviewItem } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { ReviewPanel } from "@/components/review/review-panel";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReviewDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const { setZones, activeZone } = useZoneNav();
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setZones(["sidebar", "content"]);
  }, [setZones]);

  const isContentActive = activeZone === "content";

  // Card count: Output + (Judge if present) + Action Bar
  const hasJudge = !!review?.judgeAssessment;
  const cardCount = hasJudge ? 3 : 2;

  const { getItemProps } = useKeyboardNav({
    itemCount: cardCount,
    onSelect: () => {},
    enabled: isContentActive,
  });

  useEffect(() => {
    async function fetchReview() {
      try {
        const res = await fetch(`/api/review/${runId}`);
        if (res.status === 404) {
          setError("not_found");
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load review");
          return;
        }
        const data = await res.json();
        setReview(data.review);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchReview();
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="max-w-3xl mx-auto py-12 px-8 text-center space-y-4">
        <h1 className="font-heading text-xl">Review not found</h1>
        <p className="text-muted-foreground">
          This review may have already been completed or the run no longer
          exists.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/review">
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Review Queue
          </Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-8 text-center space-y-4">
        <h1 className="font-heading text-xl">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="ghost" asChild>
          <Link href="/review">
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Review Queue
          </Link>
        </Button>
      </div>
    );
  }

  if (!review) return null;

  if (review.run.status !== "waiting_for_review") {
    return (
      <div className="max-w-3xl mx-auto py-12 px-8 text-center space-y-4">
        <h1 className="font-heading text-xl">Already reviewed</h1>
        <p className="text-muted-foreground">
          This run is no longer waiting for review. Current status:{" "}
          <strong>{review.run.status}</strong>
        </p>
        <Button
          variant="ghost"
          onClick={() => router.push(`/runs/${runId}`)}
        >
          <ArrowLeft className="size-4 mr-1.5" />
          View Run Detail
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/review">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-xl">
            {review.workflowName} — Review
          </h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Run {review.run.id.slice(0, 8)}
          </p>
        </div>
      </div>

      <ReviewPanel review={review} getCardProps={getItemProps} />
    </div>
  );
}
