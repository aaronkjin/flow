import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_SIZE = 10 * 1024 * 1024;

const TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
]);

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function isTextFile(mime: string, name: string): boolean {
  if (TEXT_TYPES.has(mime)) return true;
  const ext = name.split(".").pop()?.toLowerCase();
  return ["txt", "csv", "md", "html", "json", "xml"].includes(ext ?? "");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

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

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 10 MB limit", code: "FILE_TOO_LARGE" },
      { status: 413 }
    );
  }

  const mime = file.type;
  const name = file.name;

  if (isTextFile(mime, name)) {
    const text = await file.text();
    return NextResponse.json({
      text,
      source: name,
      metadata: { type: "text", mime, size: file.size },
    });
  }

  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const buffer = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      await parser.load();
      const result = await parser.getText();
      return NextResponse.json({
        text: result.text,
        source: name,
        metadata: {
          type: "pdf",
          pages: result.total,
          size: file.size,
        },
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to extract PDF text",
          code: "PDF_ERROR",
        },
        { status: 422 }
      );
    }
  }

  if (IMAGE_TYPES.has(mime)) {
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    try {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const dataUrl = `data:${mime};base64,${base64}`;

      const client = new OpenAI({ apiKey, timeout: 60000 });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all visible text from this image. Return only the extracted text, preserving the original structure and formatting as much as possible. If there is no readable text, return an empty string.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 4096,
      });

      const text = response.choices[0].message.content ?? "";
      return NextResponse.json({
        text,
        source: name,
        metadata: { type: "image_ocr", mime, size: file.size },
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to extract text from image",
          code: "OCR_ERROR",
        },
        { status: 422 }
      );
    }
  }

  return NextResponse.json(
    {
      error: `Unsupported file type: ${mime || name}. Supported: PDF, images (png/jpg/webp/gif), and text files (txt/csv/md/html/json/xml).`,
      code: "UNSUPPORTED_TYPE",
    },
    { status: 415 }
  );
}
