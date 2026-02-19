"use client";

interface TokenUsageBadgeProps {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
  compact?: boolean;
}

export function TokenUsageBadge({
  promptTokens,
  completionTokens,
  totalTokens,
  costUsd,
  compact = true,
}: TokenUsageBadgeProps) {
  if (compact) {
    return (
      <span className="text-xs text-muted-foreground/60 tabular-nums font-mono">
        {totalTokens.toLocaleString()} tok
      </span>
    );
  }

  const formattedCost =
    costUsd != null
      ? costUsd < 0.01
        ? costUsd.toFixed(4)
        : costUsd.toFixed(2)
      : null;

  return (
    <span className="text-xs text-muted-foreground/60 tabular-nums font-mono">
      {promptTokens.toLocaleString()} in + {completionTokens.toLocaleString()}{" "}
      out = {totalTokens.toLocaleString()}
      {formattedCost != null && ` (~$${formattedCost})`}
    </span>
  );
}
