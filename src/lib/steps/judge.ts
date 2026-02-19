import OpenAI from "openai";
import type { InterpolationContext, JudgeCriterion } from "@/lib/engine/types";

export async function executeJudgeStep(
  config: Record<string, unknown>,
  context: InterpolationContext
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const inputStepId = config.inputStepId as string;
  const criteria = config.criteria as JudgeCriterion[];
  const threshold = config.threshold as number;
  const model = (config.model as string) || "gpt-4o-mini";

  const stepOutput = context.steps[inputStepId];
  if (!stepOutput) {
    throw new Error(`Judge: input step "${inputStepId}" has no output in context`);
  }

  const contentToJudge =
    typeof stepOutput === "string" ? stepOutput : JSON.stringify(stepOutput, null, 2);

  const criteriaBlock = criteria
    .map((c) => `- ${c.name} (weight: ${c.weight}): ${c.description}`)
    .join("\n");

  const systemMessage = `You are a quality assessment judge. Evaluate the following output against the given criteria.
You MUST respond with valid JSON matching this exact schema:
{
  "criteriaScores": { "<criterionName>": <score 0.0-1.0>, ... },
  "overallConfidence": <weighted average 0.0-1.0>,
  "issues": ["<issue description>", ...],
  "recommendation": "pass" | "flag" | "fail",
  "reasoning": "<brief explanation>"
}`;

  const userMessage = `## Criteria
${criteriaBlock}

## Content to Evaluate
${contentToJudge}`;

  const client = new OpenAI({ apiKey, timeout: 30000 });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0].message.content ?? "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      criteriaScores: {},
      overallConfidence: 0,
      issues: ["Failed to parse judge response"],
      recommendation: "flag",
      reasoning: rawContent,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  const overallConfidence = Number(parsed.overallConfidence) || 0;

  let recommendation: "pass" | "flag" | "fail";
  if (overallConfidence >= threshold) {
    recommendation = "pass";
  } else if (overallConfidence >= threshold * 0.6) {
    recommendation = "flag";
  } else {
    recommendation = "fail";
  }

  return {
    criteriaScores: (parsed.criteriaScores as Record<string, number>) ?? {},
    overallConfidence,
    issues: (parsed.issues as string[]) ?? [],
    recommendation,
    reasoning: (parsed.reasoning as string) ?? "",
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}
