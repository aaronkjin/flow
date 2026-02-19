export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenUsageSummary {
  total: TokenUsage;
  byStep: Record<string, TokenUsage>;
  estimatedCostUsd: number;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4.1": { input: 0.002, output: 0.008 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-5.2": { input: 0.003, output: 0.012 },
};
const DEFAULT_PRICING = { input: 0.005, output: 0.015 };

export function estimateCost(model: string, usage: TokenUsage): number {
  const pricing =
    MODEL_PRICING[model] ??
    MODEL_PRICING[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")] ??
    DEFAULT_PRICING;
  return (
    (usage.promptTokens / 1000) * pricing.input +
    (usage.completionTokens / 1000) * pricing.output
  );
}

export class TokenTracker {
  private byStep: Record<string, TokenUsage> = {};
  private total: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  private costAccumulator = 0;

  addUsage(stepId: string, usage: TokenUsage, model?: string): void {
    if (!this.byStep[stepId]) {
      this.byStep[stepId] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }
    this.byStep[stepId].promptTokens += usage.promptTokens;
    this.byStep[stepId].completionTokens += usage.completionTokens;
    this.byStep[stepId].totalTokens += usage.totalTokens;

    this.total.promptTokens += usage.promptTokens;
    this.total.completionTokens += usage.completionTokens;
    this.total.totalTokens += usage.totalTokens;

    if (model) {
      this.costAccumulator += estimateCost(model, usage);
    }
  }

  getSummary(): TokenUsageSummary {
    return {
      total: { ...this.total },
      byStep: Object.fromEntries(
        Object.entries(this.byStep).map(([k, v]) => [k, { ...v }])
      ),
      estimatedCostUsd: this.costAccumulator,
    };
  }

  isOverBudget(maxTokens: number): boolean {
    return this.total.totalTokens > maxTokens;
  }
}
