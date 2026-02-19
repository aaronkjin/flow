import { NextRequest, NextResponse } from "next/server";
import type { TraceEvent } from "@/lib/engine/types";
import { readJsonArray, getTracePath } from "@/lib/persistence/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const tracePath = getTracePath(runId);
  const events = readJsonArray<TraceEvent>(tracePath);
  return NextResponse.json({ events }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
