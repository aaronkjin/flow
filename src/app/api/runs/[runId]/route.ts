import { NextRequest, NextResponse } from "next/server";
import { getRunStore } from "@/lib/persistence/store";

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

  return NextResponse.json({ run });
}
