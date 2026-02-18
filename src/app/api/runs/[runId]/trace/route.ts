import { NextRequest, NextResponse } from "next/server";
import type { TraceEvent } from "@/lib/engine/types";
import { readJsonArray, getTracePath } from "@/lib/persistence/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const events = readJsonArray<TraceEvent>(getTracePath(runId));
  return NextResponse.json({ events });
}
