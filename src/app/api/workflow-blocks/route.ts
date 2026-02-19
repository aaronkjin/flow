import { NextResponse } from "next/server";
import { getWorkflowStore } from "@/lib/persistence/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const workflows = getWorkflowStore().getAll();
  const blocks = workflows
    .filter((w) => w.blockConfig != null)
    .map((w) => ({
      workflowId: w.id,
      blockName: w.blockConfig!.blockName,
      blockDescription: w.blockConfig!.blockDescription,
      blockIcon: w.blockConfig!.blockIcon,
      inputSchema: w.blockConfig!.inputSchema,
      outputStepId: w.blockConfig!.outputStepId,
    }));
  return NextResponse.json({ blocks });
}
