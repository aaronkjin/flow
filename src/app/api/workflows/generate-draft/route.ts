import { NextRequest, NextResponse } from "next/server";
import { generateCopilotDraft } from "@/lib/workflow-copilot/generate-draft";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, currentWorkflow, artifactIds } = body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { error: "Message is required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const result = await generateCopilotDraft({
      message: message.trim(),
      conversationHistory: conversationHistory ?? [],
      currentWorkflow: currentWorkflow ?? null,
      artifactIds: Array.isArray(artifactIds) ? artifactIds : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json(
      { error: msg, code: "GENERATION_ERROR" },
      { status: 500 }
    );
  }
}
