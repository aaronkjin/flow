import fs from "fs";
import path from "path";
import type { DatasetConfig } from "@/lib/engine/types";

const DATASETS_DIR = path.join(process.cwd(), "data", "datasets");

export interface DatasetFile {
  config: DatasetConfig;
  items: unknown[];
}

function readDatasetFile(datasetId: string): DatasetFile | null {
  const filePath = path.join(DATASETS_DIR, `${datasetId}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatasetFile>;
    if (!parsed.config || typeof parsed.config.id !== "string") return null;
    return {
      config: parsed.config as DatasetConfig,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return null;
  }
}

export function listDatasets(): DatasetConfig[] {
  if (!fs.existsSync(DATASETS_DIR)) return [];

  const files = fs.readdirSync(DATASETS_DIR).filter((f) => f.endsWith(".json"));
  const configs: DatasetConfig[] = [];

  for (const file of files) {
    const dataset = readDatasetFile(path.basename(file, ".json"));
    if (dataset) configs.push(dataset.config);
  }

  return configs;
}

export function getDataset(
  datasetId: string,
  options?: { offset?: number; limit?: number }
): { dataset: DatasetConfig; total: number; items: unknown[] } | null {
  const datasetFile = readDatasetFile(datasetId);
  if (!datasetFile) return null;

  const offset = Math.max(0, options?.offset ?? 0);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 10));

  const items = datasetFile.items.slice(offset, offset + limit);

  return {
    dataset: datasetFile.config,
    total: datasetFile.items.length,
    items,
  };
}
