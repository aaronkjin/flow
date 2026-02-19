import { NextRequest, NextResponse } from "next/server";
import { getWorkflowStore } from "@/lib/persistence/store";
import { inferInputSchema } from "@/lib/engine/input-schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const workflow = getWorkflowStore().get(workflowId);

  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const schema = inferInputSchema(workflow);
  return NextResponse.json({ schema });
}
