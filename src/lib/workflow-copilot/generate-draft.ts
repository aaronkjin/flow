
import OpenAI from "openai";
import type {
  CopilotGenerateRequest,
  CopilotGenerateResponse,
  CopilotDraftWorkflow,
} from "./types";
import { parseCopilotDraft } from "./schema";
import { validateCopilotDraft } from "./validate-draft";
import { compileCopilotDraft } from "./compile-draft";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { resolveArtifactContext } from "./resolve-artifacts";

const MAX_STEPS = 20;
const MODEL = "gpt-5.2";

export async function generateCopilotDraft(
  request: CopilotGenerateRequest
): Promise<CopilotGenerateResponse> {
  if (!request.message || request.message.trim() === "") {
    throw new Error("Message is required");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey, timeout: 30000 });

  const { groundingSection, warnings: artifactWarnings } =
    await resolveArtifactContext(request.artifactIds);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    request.message,
    request.currentWorkflow,
    groundingSection || null
  );

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (request.conversationHistory) {
    for (const msg of request.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userPrompt });

  let draft: CopilotDraftWorkflow;
  let rawContent: string;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new Error(
      `OpenAI API call failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  try {
    draft = parseCopilotDraft(rawContent);
  } catch (err) {
    throw new Error(
      `Failed to parse generated draft: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  if (draft.steps.length > MAX_STEPS) {
    throw new Error(
      `Generated draft has ${draft.steps.length} steps (max ${MAX_STEPS}). Please simplify your request.`
    );
  }

  let validation = validateCopilotDraft(draft);

  if (artifactWarnings.length > 0) {
    validation = {
      ...validation,
      warnings: [...validation.warnings, ...artifactWarnings],
    };
  }

  if (!validation.ok) {
    try {
      const repairMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...messages,
        { role: "assistant", content: rawContent },
        {
          role: "user",
          content: `The draft has validation errors. Please fix these issues and return corrected JSON only:\n\n${validation.errors.join("\n")}`,
        },
      ];

      const repairResponse = await client.chat.completions.create({
        model: MODEL,
        messages: repairMessages,
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const repairContent =
        repairResponse.choices[0]?.message?.content ?? "";
      const repairedDraft = parseCopilotDraft(repairContent);

      if (repairedDraft.steps.length > MAX_STEPS) {
      } else {
        draft = repairedDraft;
        validation = validateCopilotDraft(draft);
      }
    } catch {
    }
  }

  const compiledPreview = compileCopilotDraft(draft);

  return {
    draft,
    validation,
    compiledPreview,
  };
}
