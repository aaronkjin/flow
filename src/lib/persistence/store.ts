import fs from "fs";
import path from "path";
import type { Run, WorkflowDefinition } from "@/lib/engine/types";

const DATA_ROOT = path.join(process.cwd(), "data");

export class JsonStore<T extends { id: string }> {
  private directory: string;
  private cache: Map<string, T> = new Map();
  private loaded = false;

  constructor(subdir: string) {
    this.directory = path.join(DATA_ROOT, subdir);
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  private filePath(id: string): string {
    return path.join(this.directory, `${id}.json`);
  }

  private loadAll(): void {
    if (this.loaded) return;
    this.ensureDirectory();
    const files = fs.readdirSync(this.directory).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.directory, file), "utf-8");
        const item = JSON.parse(raw) as T;
        this.cache.set(item.id, item);
      } catch {
      }
    }
    this.loaded = true;
  }

  getAll(): T[] {
    this.loadAll();
    return Array.from(this.cache.values());
  }

  get(id: string): T | null {
    this.loadAll();
    const cached = this.cache.get(id);
    if (cached) return cached;

    const fp = this.filePath(id);
    if (fs.existsSync(fp)) {
      try {
        const raw = fs.readFileSync(fp, "utf-8");
        const item = JSON.parse(raw) as T;
        this.cache.set(item.id, item);
        return item;
      } catch {
        return null;
      }
    }
    return null;
  }

  save(id: string, data: T): void {
    this.loadAll();
    this.cache.set(id, data);
    this.ensureDirectory();
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2), "utf-8");
  }

  delete(id: string): boolean {
    this.loadAll();
    const existed = this.cache.delete(id);
    const fp = this.filePath(id);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
    }
    return existed;
  }
}

export function appendToJsonArray<T>(filepath: string, item: T): void {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let arr: T[] = [];
  if (fs.existsSync(filepath)) {
    try {
      const raw = fs.readFileSync(filepath, "utf-8");
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  arr.push(item);
  fs.writeFileSync(filepath, JSON.stringify(arr, null, 2), "utf-8");
}

export function readJsonArray<T>(filepath: string): T[] {
  if (!fs.existsSync(filepath)) return [];
  try {
    const raw = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}


const globalForStores = globalThis as unknown as {
  __workflowStore?: JsonStore<WorkflowDefinition>;
  __runStore?: JsonStore<Run>;
};

export function getWorkflowStore() {
  if (!globalForStores.__workflowStore) {
    globalForStores.__workflowStore = new JsonStore<WorkflowDefinition>("workflows");
  }
  return globalForStores.__workflowStore;
}

export function getRunStore() {
  if (!globalForStores.__runStore) {
    globalForStores.__runStore = new JsonStore<Run>("runs");
  }
  return globalForStores.__runStore;
}

export function getTracePath(runId: string): string {
  return path.join(DATA_ROOT, "traces", `${runId}-trace.json`);
}
