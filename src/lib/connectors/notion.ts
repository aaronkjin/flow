import { Client } from "@notionhq/client";
import type { Connector, ConnectorResult } from "@/lib/engine/types";
import { registerConnector } from "@/lib/connectors/registry";

const NOTION_PROPERTY_KEYS = new Set([
  "title",
  "rich_text",
  "number",
  "select",
  "multi_select",
  "date",
  "people",
  "files",
  "checkbox",
  "url",
  "email",
  "phone_number",
  "formula",
  "relation",
  "rollup",
  "status",
]);

const NOTION_TEXT_CONTENT_MAX_LENGTH = 2000;

type NotionTextFragment = {
  text: { content: string; link?: unknown };
  [key: string]: unknown;
};

function chunkTextContent(text: string, maxLength = NOTION_TEXT_CONTENT_MAX_LENGTH): string[] {
  if (!text) return [];

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

function normalizeTextFragments(fragments: unknown): unknown {
  if (!Array.isArray(fragments)) return fragments;

  const normalized: unknown[] = [];
  for (const fragment of fragments) {
    if (typeof fragment !== "object" || fragment === null) {
      normalized.push(fragment);
      continue;
    }

    const typed = fragment as NotionTextFragment;
    const content = typed.text?.content;

    if (typeof content !== "string" || content.length <= NOTION_TEXT_CONTENT_MAX_LENGTH) {
      normalized.push(fragment);
      continue;
    }

    const chunks = chunkTextContent(content);
    for (const chunk of chunks) {
      normalized.push({
        ...typed,
        text: {
          ...(typed.text ?? {}),
          content: chunk,
        },
      });
    }
  }

  return normalized;
}

function normalizePropertyObject(value: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(value.rich_text)) {
    return { ...value, rich_text: normalizeTextFragments(value.rich_text) };
  }

  if (Array.isArray(value.title)) {
    return { ...value, title: normalizeTextFragments(value.title) };
  }

  return value;
}

function isNotionPropertyObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value as Record<string, unknown>).some((key) =>
    NOTION_PROPERTY_KEYS.has(key)
  );
}

async function getDatabaseSchema(
  notion: Client,
  databaseId: string
): Promise<Record<string, string>> {
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const types: Record<string, string> = {};
    if ("properties" in db && db.properties) {
      for (const [name, prop] of Object.entries(db.properties)) {
        types[name] = (prop as { type: string }).type;
      }
    }
    return types;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Notion: failed to retrieve database schema for "${databaseId}": ${msg}. Using heuristic property conversion.`);
    return {};
  }
}

function convertStringForType(value: string, propType: string): unknown {
  switch (propType) {
    case "title":
      return {
        title: chunkTextContent(value).map((chunk) => ({
          text: { content: chunk },
        })),
      };
    case "select":
      return { select: { name: value } };
    case "status":
      return { status: { name: value } };
    case "url":
      return { url: value };
    case "email":
      return { email: value };
    case "phone_number":
      return { phone_number: value };
    case "rich_text":
    default:
      return {
        rich_text: chunkTextContent(value).map((chunk) => ({
          text: { content: chunk },
        })),
      };
  }
}

const TITLE_HEURISTIC_NAMES = new Set(["name", "title"]);

function convertProperties(
  properties: Record<string, unknown>,
  schema?: Record<string, string>
): Record<string, unknown> {
  const converted: Record<string, unknown> = {};
  const hasSchema = schema && Object.keys(schema).length > 0;

  let heuristicTitleKey: string | null = null;
  if (!hasSchema) {
    const keys = Object.keys(properties);
    heuristicTitleKey =
      keys.find((k) => TITLE_HEURISTIC_NAMES.has(k.toLowerCase())) ?? null;
  }

  for (const [key, value] of Object.entries(properties)) {
    if (hasSchema && !schema[key]) {
      console.warn(`Notion: skipping property "${key}" — not found in database schema`);
      continue;
    }

    if (isNotionPropertyObject(value)) {
      converted[key] = normalizePropertyObject(value as Record<string, unknown>);
    } else if (typeof value === "string") {
      let propType: string;
      if (hasSchema) {
        propType = schema[key];
      } else if (key === heuristicTitleKey) {
        propType = "title";
      } else {
        propType = "rich_text";
      }
      converted[key] = convertStringForType(value, propType);
    } else if (typeof value === "number") {
      converted[key] = { number: value };
    } else if (typeof value === "boolean") {
      converted[key] = { checkbox: value };
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

const notionConnector: Connector = {
  type: "notion",

  async execute(
    action: string,
    params: Record<string, unknown>
  ): Promise<ConnectorResult> {
    const apiKey =
      (params.apiKey as string | undefined) || process.env.NOTION_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error:
          "No Notion API key configured. Set NOTION_API_KEY env var or provide apiKey in params.",
      };
    }

    const notion = new Client({ auth: apiKey });

    switch (action) {
      case "create_page": {
        const databaseId = params.databaseId as string;
        const properties = params.properties as Record<string, unknown>;

        if (!databaseId || !properties) {
          return {
            success: false,
            error: "create_page requires databaseId and properties params.",
          };
        }

        try {
          const schema = await getDatabaseSchema(notion, databaseId);
          const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: convertProperties(properties, schema) as Parameters<
              typeof notion.pages.create
            >[0]["properties"],
          });

          return {
            success: true,
            data: {
              pageId: response.id,
              url: "url" in response ? (response.url as string) : undefined,
            },
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Notion API error: ${message}` };
        }
      }

      case "update_page": {
        const pageId = params.pageId as string;
        const properties = params.properties as Record<string, unknown>;

        if (!pageId || !properties) {
          return {
            success: false,
            error: "update_page requires pageId and properties params.",
          };
        }

        try {
          const response = await notion.pages.update({
            page_id: pageId,
            properties: convertProperties(properties) as Parameters<
              typeof notion.pages.update
            >[0]["properties"],
          });

          return {
            success: true,
            data: { pageId: response.id },
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Notion API error: ${message}` };
        }
      }

      default:
        return {
          success: false,
          error: `Unknown Notion action: "${action}". Supported: create_page, update_page`,
        };
    }
  },
};

registerConnector(notionConnector);
