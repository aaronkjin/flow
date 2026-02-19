export interface CopilotArtifactRef {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ExtractedArtifactContext {
  artifactId: string;
  name: string;
  summary: string;
  keyEntities: string[];
  keyFields: Record<string, string | number | boolean>;
  rawExcerpt?: string;
  confidence?: number;
  extractionType: "text" | "pdf" | "image_vision";
}

export const MAX_ARTIFACT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ARTIFACTS_PER_REQUEST = 5;
export const MAX_CONTEXT_LENGTH_CHARS = 8000;

export const ALLOWED_TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
]);

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const ALLOWED_MIME_TYPES = new Set([
  ...ALLOWED_TEXT_TYPES,
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
]);

export function isTextFileByExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return ["txt", "csv", "md", "html", "json", "xml", "yaml", "yml"].includes(
    ext ?? ""
  );
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "artifact";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}
