import { NextRequest, NextResponse } from "next/server";
import { resumeRun } from "@/lib/engine/engine";
import type { HITLDecision } from "@/lib/engine/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const body = await request.json();
  const { decision } = body as { decision: HITLDecision };

  if (!decision || !decision.action) {
    return NextResponse.json(
      { error: "decision with action is required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  try {
    const run = await resumeRun(runId, decision);
    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isValidation =
      message.includes("not found") || message.includes("not waiting");
    return NextResponse.json(
      { error: message, code: isValidation ? "INVALID_INPUT" : "ENGINE_ERROR" },
      { status: isValidation ? 400 : 500 }
    );
  }
}
