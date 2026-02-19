import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface FieldSpec {
  name: string;
  type: "string" | "number" | "text" | "boolean" | "json";
  description?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured", code: "CONFIG_ERROR" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { text, fields } = body as { text: string; fields: FieldSpec[] };

  if (!text || !fields || fields.length === 0) {
    return NextResponse.json(
      { error: "Both text and fields are required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const fieldDescriptions = fields
    .map((f) => {
      const typeHint =
        f.type === "number"
          ? "numeric value"
          : f.type === "boolean"
            ? "true or false"
            : f.type === "json"
              ? "JSON object or array"
              : "text string";
      const desc = f.description ? ` — ${f.description}` : "";
      return `- "${f.name}" (${typeHint})${desc}`;
    })
    .join("\n");

  const systemPrompt = `You are a structured data extractor. Given unstructured text (an email, support ticket, document, message, etc.) and a list of fields to extract, return a JSON object with the extracted values.

Rules:
- Extract values from the text that best match each field.
- For fields not found in the text: use "" for text/string fields, 0 for number fields, false for boolean fields.
- For number fields, return a numeric value (not a string).
- For boolean fields, infer from context (e.g., words like "urgent", "critical", "ASAP" suggest true for urgency-related fields).
- Keep extracted text concise and relevant to the field name.
- Return ONLY the JSON object with the field names as keys.`;

  const userPrompt = `Extract the following fields from the text below.

Fields:
${fieldDescriptions}

Text:
"""
${text}
"""`;

  try {
    const client = new OpenAI({ apiKey, timeout: 30000 });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0].message.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const val = parsed[field.name];
      if (field.type === "number") {
        result[field.name] = typeof val === "number" ? val : Number(val) || 0;
      } else if (field.type === "boolean") {
        result[field.name] = Boolean(val);
      } else if (field.type === "json") {
        result[field.name] = typeof val === "object" && val !== null ? val : {};
      } else {
        result[field.name] = val != null ? String(val) : "";
      }
    }

    return NextResponse.json({ parsed: result });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to parse input",
        code: "PARSE_ERROR",
      },
      { status: 500 }
    );
  }
}
