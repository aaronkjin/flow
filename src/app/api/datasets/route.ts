import { NextResponse } from "next/server";
import { listDatasets } from "@/lib/datasets/loader";

export const dynamic = "force-dynamic";

export async function GET() {
  const datasets = listDatasets();
  return NextResponse.json({ datasets });
}
