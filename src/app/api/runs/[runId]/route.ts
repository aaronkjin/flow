import { NextRequest, NextResponse } from "next/server";
import { getRunStore, readJsonArray, getTracePath } from "@/lib/persistence/store";
import type { TraceEvent } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

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

  const traceEvents = readJsonArray<TraceEvent>(getTracePath(runId));

  return NextResponse.json({ run, traceEvents }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
