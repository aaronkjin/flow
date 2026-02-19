import type { Tool, ToolParameterSchema } from "./types";
import { getConnector } from "../connectors/registry";
import "../connectors";

interface ConnectorActionMeta {
  action: string;
  description: string;
  parameters: ToolParameterSchema;
}

const CONNECTOR_ACTION_MAP: Record<string, ConnectorActionMeta[]> = {
  slack: [
    {
      action: "send_message",
      description: "Send a message to a Slack channel via webhook",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Message text to send" },
          channel: {
            type: "string",
            description: "Slack channel to post to (optional override)",
          },
          username: {
            type: "string",
            description: "Bot username to display (optional)",
          },
          icon_emoji: {
            type: "string",
            description: "Bot icon emoji (e.g. ':robot_face:') (optional)",
          },
          webhookUrl: {
            type: "string",
            description:
              "Slack webhook URL (optional, falls back to SLACK_WEBHOOK_URL env var)",
          },
        },
        required: ["text"],
      },
    },
  ],

  http: [
    {
      action: "request",
      description: "Make an HTTP request to any URL",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to request" },
          method: {
            type: "string",
            description: "HTTP method (defaults to POST)",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          headers: {
            type: "object",
            description: "Request headers as key-value pairs",
          },
          body: { type: "object", description: "Request body (JSON)" },
          authType: {
            type: "string",
            description: "Authentication type",
            enum: ["none", "bearer", "api-key"],
          },
          authToken: {
            type: "string",
            description:
              "Auth token (used as Bearer token or X-API-Key depending on authType)",
          },
        },
        required: ["url"],
      },
    },
  ],

  email: [
    {
      action: "send_email",
      description: "Send an email via Resend",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          html: { type: "string", description: "Email body as HTML" },
          from: {
            type: "string",
            description:
              "Sender address (optional, defaults to 'Action <onboarding@resend.dev>')",
          },
          replyTo: {
            type: "string",
            description: "Reply-to email address",
          },
          apiKey: {
            type: "string",
            description:
              "Resend API key (optional, falls back to RESEND_API_KEY env var)",
          },
        },
        required: ["to", "subject", "html"],
      },
    },
  ],

  notion: [
    {
      action: "create_page",
      description: "Create a new page in a Notion database",
      parameters: {
        type: "object",
        properties: {
          databaseId: {
            type: "string",
            description: "Notion database ID to add the page to",
          },
          properties: {
            type: "object",
            description: "Page properties as key-value pairs",
          },
          apiKey: {
            type: "string",
            description:
              "Notion API key (optional, falls back to NOTION_API_KEY env var)",
          },
        },
        required: ["databaseId", "properties"],
      },
    },
    {
      action: "update_page",
      description: "Update an existing Notion page's properties",
      parameters: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            description: "Notion page ID to update",
          },
          properties: {
            type: "object",
            description: "Properties to update as key-value pairs",
          },
          apiKey: {
            type: "string",
            description:
              "Notion API key (optional, falls back to NOTION_API_KEY env var)",
          },
        },
        required: ["pageId", "properties"],
      },
    },
  ],

  "google-sheets": [
    {
      action: "append_row",
      description: "Append a row to a Google Sheets spreadsheet",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: {
            type: "string",
            description: "Google Sheets spreadsheet ID",
          },
          range: {
            type: "string",
            description: "Sheet range in A1 notation (e.g. 'Sheet1!A:Z')",
          },
          values: {
            type: "array",
            description: "Row values to append",
            items: { type: "string" },
          },
          serviceAccountJson: {
            type: "string",
            description:
              "Google service account JSON (optional, falls back to GOOGLE_SERVICE_ACCOUNT_JSON env var)",
          },
        },
        required: ["spreadsheetId", "range", "values"],
      },
    },
    {
      action: "read_range",
      description: "Read a range of cells from a Google Sheets spreadsheet",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: {
            type: "string",
            description: "Google Sheets spreadsheet ID",
          },
          range: {
            type: "string",
            description: "Sheet range in A1 notation (e.g. 'Sheet1!A1:D10')",
          },
          serviceAccountJson: {
            type: "string",
            description:
              "Google service account JSON (optional, falls back to GOOGLE_SERVICE_ACCOUNT_JSON env var)",
          },
        },
        required: ["spreadsheetId", "range"],
      },
    },
  ],
};

export function createConnectorTools(): Tool[] {
  const tools: Tool[] = [];

  for (const [connectorType, actions] of Object.entries(
    CONNECTOR_ACTION_MAP
  )) {
    const connector = getConnector(connectorType);

    if (!connector) {
      console.warn(
        `[tool-system] Connector "${connectorType}" not registered, skipping tool creation`
      );
      continue;
    }

    for (const meta of actions) {
      const toolName = `${connectorType.replace(/-/g, "_")}_${meta.action}`;

      tools.push({
        definition: {
          name: toolName,
          description: meta.description,
          category: "connector",
          parameters: meta.parameters,
          connectorRef: { connectorType, action: meta.action },
        },
        execute: async (params, _context) => {
          const start = Date.now();
          try {
            const result = await connector.execute(meta.action, params);
            return {
              success: result.success ?? true,
              data: result.data ?? result,
              executionTimeMs: Date.now() - start,
            };
          } catch (err) {
            return {
              success: false,
              data: null,
              error: err instanceof Error ? err.message : String(err),
              executionTimeMs: Date.now() - start,
            };
          }
        },
      });
    }
  }

  return tools;
}
