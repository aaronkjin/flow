import { NextRequest, NextResponse } from "next/server";
import type { HITLDecision, Run } from "@/lib/engine/types";
import { getRunStore } from "@/lib/persistence/store";
import { resumeRun } from "@/lib/engine/engine";
import { buildReviewItem } from "../route";

const VALID_ACTIONS = new Set(["approve", "edit", "reject"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = getRunStore().get(runId);

  if (!run) {
    return NextResponse.json(
      { error: "Run not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (run.status !== "waiting_for_review") {
    return NextResponse.json(
      { error: "Run is not waiting for review", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const review = buildReviewItem(run);
  if (!review) {
    return NextResponse.json(
      { error: "Unable to build review context (workflow may have been deleted)", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ review });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const { action, editedOutput, comment } = body as {
    action?: string;
    editedOutput?: Record<string, unknown>;
    comment?: string;
  };

  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        error: "action is required and must be one of: approve, edit, reject",
        code: "INVALID_INPUT",
      },
      { status: 400 }
    );
  }

  const run = getRunStore().get(runId);
  if (!run) {
    return NextResponse.json(
      { error: "Run not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const decision: HITLDecision = {
    action: action as HITLDecision["action"],
    editedOutput,
    comment,
  };

  try {
    const updatedRun: Run = await resumeRun(runId, decision);
    return NextResponse.json({ run: updatedRun });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not waiting for review")) {
      return NextResponse.json(
        { error: message, code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: message, code: "ENGINE_ERROR" },
      { status: 500 }
    );
  }
}
