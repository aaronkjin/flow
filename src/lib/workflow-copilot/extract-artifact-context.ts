
import * as fs from "fs/promises";
import * as path from "path";
import OpenAI from "openai";
import type { ExtractedArtifactContext, CopilotArtifactRef } from "./artifact-types";
import {
  ALLOWED_TEXT_TYPES,
  ALLOWED_IMAGE_TYPES,
  isTextFileByExtension,
} from "./artifact-types";

const ARTIFACTS_DIR = path.join(process.cwd(), "data", "tmp", "copilot-artifacts");

const MAX_RAW_FOR_SUMMARY = 6000;
const MAX_EXCERPT_LENGTH = 2000;

export async function extractArtifactContext(
  ref: CopilotArtifactRef
): Promise<ExtractedArtifactContext | null> {
  const filePath = path.join(ARTIFACTS_DIR, ref.id);

  try {
    await fs.access(filePath);
  } catch {
    console.warn(`Artifact file not found: ${filePath}`);
    return null;
  }

  try {
    if (
      ALLOWED_TEXT_TYPES.has(ref.mimeType) ||
      isTextFileByExtension(ref.name)
    ) {
      return await extractTextContext(ref, filePath);
    }

    if (
      ref.mimeType === "application/pdf" ||
      ref.name.toLowerCase().endsWith(".pdf")
    ) {
      return await extractPdfContext(ref, filePath);
    }

    if (ALLOWED_IMAGE_TYPES.has(ref.mimeType)) {
      return await extractImageContext(ref, filePath);
    }

    console.warn(`Unsupported MIME type for extraction: ${ref.mimeType}`);
    return null;
  } catch (err) {
    console.warn(
      `Artifact extraction failed for ${ref.name}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function extractAllArtifactContexts(
  refs: CopilotArtifactRef[]
): Promise<{
  contexts: ExtractedArtifactContext[];
  warnings: string[];
}> {
  const contexts: ExtractedArtifactContext[] = [];
  const warnings: string[] = [];

  for (const ref of refs) {
    const ctx = await extractArtifactContext(ref);
    if (ctx) {
      contexts.push(ctx);
    } else {
      warnings.push(
        `Could not extract context from "${ref.name}" — generation will proceed without it.`
      );
    }
  }

  return { contexts, warnings };
}


async function extractTextContext(
  ref: CopilotArtifactRef,
  filePath: string
): Promise<ExtractedArtifactContext> {
  const raw = await fs.readFile(filePath, "utf-8");
  const truncated = raw.slice(0, MAX_RAW_FOR_SUMMARY);

  if (raw.length <= 500) {
    return {
      artifactId: ref.id,
      name: ref.name,
      summary: raw.trim(),
      keyEntities: extractKeyEntities(raw),
      keyFields: tryExtractJsonFields(raw),
      rawExcerpt: raw.slice(0, MAX_EXCERPT_LENGTH),
      confidence: 1.0,
      extractionType: "text",
    };
  }

  const summary = await llmSummarize(truncated, ref.name);

  return {
    artifactId: ref.id,
    name: ref.name,
    summary,
    keyEntities: extractKeyEntities(raw),
    keyFields: tryExtractJsonFields(raw),
    rawExcerpt: raw.slice(0, MAX_EXCERPT_LENGTH),
    confidence: 0.9,
    extractionType: "text",
  };
}


async function extractPdfContext(
  ref: CopilotArtifactRef,
  filePath: string
): Promise<ExtractedArtifactContext> {
  const buffer = await fs.readFile(filePath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();

  const raw = result.text ?? "";
  const truncated = raw.slice(0, MAX_RAW_FOR_SUMMARY);

  const summary =
    raw.length <= 500
      ? raw.trim()
      : await llmSummarize(truncated, ref.name);

  return {
    artifactId: ref.id,
    name: ref.name,
    summary,
    keyEntities: extractKeyEntities(raw),
    keyFields: {},
    rawExcerpt: raw.slice(0, MAX_EXCERPT_LENGTH),
    confidence: 0.85,
    extractionType: "pdf",
  };
}


async function extractImageContext(
  ref: CopilotArtifactRef,
  filePath: string
): Promise<ExtractedArtifactContext | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not configured — skipping image extraction");
    return null;
  }

  const bytes = await fs.readFile(filePath);
  const base64 = bytes.toString("base64");
  const dataUrl = `data:${ref.mimeType};base64,${base64}`;

  const client = new OpenAI({ apiKey, timeout: 60000 });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image ("${ref.name}") for workflow automation context. Return a JSON object with:
- "summary": A 2-3 sentence description of what this image shows and what workflow it might relate to.
- "keyEntities": Array of key entities, terms, or concepts visible (max 10).
- "keyFields": Object of any structured data visible (field names as keys, values as strings/numbers).

Return ONLY valid JSON.`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  return {
    artifactId: ref.id,
    name: ref.name,
    summary:
      typeof parsed.summary === "string"
        ? parsed.summary
        : "Image uploaded as context.",
    keyEntities: Array.isArray(parsed.keyEntities)
      ? (parsed.keyEntities as unknown[])
          .filter((e): e is string => typeof e === "string")
          .slice(0, 10)
      : [],
    keyFields:
      parsed.keyFields &&
      typeof parsed.keyFields === "object" &&
      !Array.isArray(parsed.keyFields)
        ? (parsed.keyFields as Record<string, string | number | boolean>)
        : {},
    confidence: 0.7,
    extractionType: "image_vision",
  };
}


async function llmSummarize(text: string, fileName: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return text.slice(0, 300).trim() + (text.length > 300 ? "..." : "");
  }

  const client = new OpenAI({ apiKey, timeout: 30000 });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You summarize documents for workflow automation context. Be concise (2-4 sentences). Focus on: what this document is about, what processes/entities it describes, what automation might be relevant.",
        },
        {
          role: "user",
          content: `Summarize this document ("${fileName}"):\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 256,
    });

    return response.choices[0]?.message?.content?.trim() ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300).trim() + (text.length > 300 ? "..." : "");
  }
}

function extractKeyEntities(text: string): string[] {
  const entities = new Set<string>();

  const capitalizedPattern =
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
  let match;
  while ((match = capitalizedPattern.exec(text)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length > 2 && phrase.length < 50) {
      entities.add(phrase);
    }
    if (entities.size >= 15) break;
  }

  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  while ((match = emailPattern.exec(text)) !== null) {
    entities.add(match[0]);
    if (entities.size >= 20) break;
  }

  return Array.from(entities).slice(0, 10);
}

function tryExtractJsonFields(
  text: string
): Record<string, string | number | boolean> {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const fields: Record<string, string | number | boolean> = {};
    let count = 0;
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        fields[key] =
          typeof value === "string" ? value.slice(0, 200) : value;
        count++;
        if (count >= 10) break;
      }
    }
    return fields;
  } catch {
    return {};
  }
}
