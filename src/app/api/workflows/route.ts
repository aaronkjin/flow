import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { WorkflowDefinition } from "@/lib/engine/types";
import { getWorkflowStore } from "@/lib/persistence/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const workflows = getWorkflowStore().getAll();
  return NextResponse.json({ workflows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, steps, edges, canvasState } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "Workflow name is required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const workflow: WorkflowDefinition = {
    id: uuidv4(),
    name: name.trim(),
    description: description || "",
    steps: steps || [],
    edges: edges || [],
    canvasState: canvasState || undefined,
    createdAt: now,
    updatedAt: now,
  };

  getWorkflowStore().save(workflow.id, workflow);

  return NextResponse.json({ workflow }, { status: 201 });
}
