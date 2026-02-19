import { NextRequest, NextResponse } from "next/server";
import { refineWorkflow } from "@/lib/workflow-copilot/refine-workflow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, currentWorkflow } = body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { error: "Message is required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    if (
      !currentWorkflow ||
      !Array.isArray(currentWorkflow.steps) ||
      currentWorkflow.steps.length === 0
    ) {
      return NextResponse.json(
        {
          error: "Current workflow snapshot is required with at least one step",
          code: "INVALID_INPUT",
        },
        { status: 400 }
      );
    }

    const result = await refineWorkflow({
      message: message.trim(),
      conversationHistory: conversationHistory ?? [],
      currentWorkflow,
    });

    if (!result.validation.ok) {
      return NextResponse.json(
        {
          ...result,
          code: "VALIDATION_ERROR",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Refinement failed";
    return NextResponse.json(
      { error: msg, code: "GENERATION_ERROR" },
      { status: 500 }
    );
  }
}
