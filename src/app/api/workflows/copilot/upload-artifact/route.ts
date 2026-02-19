import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  MAX_ARTIFACT_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  isTextFileByExtension,
  sanitizeFileName,
} from "@/lib/workflow-copilot/artifact-types";
import type { CopilotArtifactRef } from "@/lib/workflow-copilot/artifact-types";
import { saveArtifactMetadata } from "@/lib/workflow-copilot/resolve-artifacts";

const ARTIFACTS_DIR = path.join(
  process.cwd(),
  "data",
  "tmp",
  "copilot-artifacts"
);

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "msi",
  "dll",
  "so",
  "dylib",
  "com",
  "scr",
  "js",
  "vbs",
  "wsf",
  "jar",
]);

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart/form-data", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided", code: "NO_FILE" },
      { status: 400 }
    );
  }

  if (file.size > MAX_ARTIFACT_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 10 MB limit", code: "FILE_TOO_LARGE" },
      { status: 413 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      {
        error: `File type '.${ext}' is not allowed`,
        code: "BLOCKED_TYPE",
      },
      { status: 415 }
    );
  }

  const mime = file.type;
  if (!ALLOWED_MIME_TYPES.has(mime) && !isTextFileByExtension(file.name)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${mime || ext}. Supported: PDF, images (png/jpg/webp), and text files.`,
        code: "UNSUPPORTED_TYPE",
      },
      { status: 415 }
    );
  }

  try {
    await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  } catch (err) {
    void err;
  }

  const id = uuidv4();
  const safeName = sanitizeFileName(file.name);
  const filePath = path.join(ARTIFACTS_DIR, id);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to save artifact: ${err instanceof Error ? err.message : "unknown"}`,
        code: "WRITE_ERROR",
      },
      { status: 500 }
    );
  }

  const ref: CopilotArtifactRef = {
    id,
    name: safeName,
    mimeType: mime || "application/octet-stream",
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
  };

  try {
    await saveArtifactMetadata(ref);
  } catch (err) {
    void err;
  }

  return NextResponse.json({ artifact: ref }, { status: 201 });
}
