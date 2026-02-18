import OpenAI from "openai";
import type { InterpolationContext } from "@/lib/engine/types";

export async function executeLLMStep(
  config: Record<string, unknown>,
  context: InterpolationContext
): Promise<Record<string, unknown>> {
  void context;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const model = (config.model as string) || "gpt-4o-mini";
  const systemPrompt = config.systemPrompt as string;
  const userPrompt = config.userPrompt as string;
  const temperature = (config.temperature as number) ?? 0.7;
  const responseFormat = config.responseFormat as "text" | "json" | undefined;

  const client = new OpenAI({ apiKey, timeout: 30000 });

  let finalSystemPrompt = systemPrompt;
  const isJson = responseFormat === "json";

  if (isJson && !/json/i.test(systemPrompt)) {
    finalSystemPrompt += "\nRespond with valid JSON.";
  }

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    ...(isJson ? { response_format: { type: "json_object" } } : {}),
  });

  const rawContent = response.choices[0].message.content ?? "";
  const usage = response.usage;

  let result: unknown = rawContent;

  if (isJson) {
    try {
      result = JSON.parse(rawContent);
    } catch (e) {
      result = {
        result: rawContent,
        parseError: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return {
    result,
    model: response.model,
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  };
}
