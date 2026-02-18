import { NextRequest, NextResponse } from "next/server";
import { getWorkflowStore } from "@/lib/persistence/store";

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

  return NextResponse.json({ workflow });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const store = getWorkflowStore();
  const existing = store.get(workflowId);

  if (!existing) {
    return NextResponse.json(
      { error: "Workflow not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { name, description, steps, edges, canvasState } = body;

  const workflow = {
    ...existing,
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(steps !== undefined && { steps }),
    ...(edges !== undefined && { edges }),
    ...(canvasState !== undefined && { canvasState }),
    updatedAt: new Date().toISOString(),
  };

  store.save(workflowId, workflow);

  return NextResponse.json({ workflow });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const store = getWorkflowStore();
  const existing = store.get(workflowId);

  if (!existing) {
    return NextResponse.json(
      { error: "Workflow not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  store.delete(workflowId);

  return NextResponse.json({ success: true });
}
