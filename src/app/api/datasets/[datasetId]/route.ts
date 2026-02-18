import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/datasets/loader";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  const { datasetId } = await params;
  const offset = Math.max(
    0,
    parseInt(request.nextUrl.searchParams.get("offset") || "0", 10) || 0
  );
  const limit = Math.min(
    100,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "10", 10) || 10)
  );

  const dataset = getDataset(datasetId, { offset, limit });
  if (!dataset) {
    return NextResponse.json(
      { error: "Dataset not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    dataset: dataset.dataset,
    items: dataset.items,
    total: dataset.total,
    offset,
    limit,
  });
}
