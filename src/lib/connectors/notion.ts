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

function isNotionPropertyObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value as Record<string, unknown>).some((key) =>
    NOTION_PROPERTY_KEYS.has(key)
  );
}

function convertProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (isNotionPropertyObject(value)) {
      converted[key] = value;
    } else if (typeof value === "string") {
      converted[key] = { rich_text: [{ text: { content: value } }] };
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
          const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: convertProperties(properties) as Parameters<
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
