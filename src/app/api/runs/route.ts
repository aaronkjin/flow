import { NextRequest, NextResponse } from "next/server";
import { getRunStore, getWorkflowStore } from "@/lib/persistence/store";
import { startRun } from "@/lib/engine/engine";

export async function GET(request: NextRequest) {
  const workflowId = request.nextUrl.searchParams.get("workflowId");
  let runs = getRunStore().getAll();

  if (workflowId) {
    runs = runs.filter((r) => r.workflowId === workflowId);
  }

  runs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workflowId, input, mode = "single" } = body as {
    workflowId?: string;
    input?: Record<string, unknown>;
    mode?: "single" | "batch";
  };

  if (!workflowId) {
    return NextResponse.json(
      { error: "workflowId is required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  if (mode !== "single" && mode !== "batch") {
    return NextResponse.json(
      { error: "mode must be 'single' or 'batch'", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const workflow = getWorkflowStore().get(workflowId);
  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (mode === "batch") {
    return NextResponse.json(
      {
        error: "Batch mode not yet implemented for Phase 1/2 scope. Use mode='single'",
        code: "INVALID_INPUT",
      },
      { status: 400 }
    );
  }

  try {
    const run = await startRun(workflowId, input || {});
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: "ENGINE_ERROR" },
      { status: 500 }
    );
  }
}
