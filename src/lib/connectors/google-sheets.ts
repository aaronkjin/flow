import { google } from "googleapis";
import type { Connector, ConnectorResult } from "@/lib/engine/types";
import { registerConnector } from "@/lib/connectors/registry";

function getServiceAccountCredentials(
  params: Record<string, unknown>
): Record<string, unknown> | null {
  const json =
    (params.serviceAccountJson as string | undefined) ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!json) return null;

  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createSheetsClient(credentials: Record<string, unknown>) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const googleSheetsConnector: Connector = {
  type: "google-sheets",

  async execute(
    action: string,
    params: Record<string, unknown>
  ): Promise<ConnectorResult> {
    const credentials = getServiceAccountCredentials(params);

    if (!credentials) {
      return {
        success: false,
        error:
          "No Google service account configured. Set GOOGLE_SERVICE_ACCOUNT_JSON env var or provide serviceAccountJson in params.",
      };
    }

    const sheets = createSheetsClient(credentials);

    switch (action) {
      case "append_row": {
        const spreadsheetId = params.spreadsheetId as string;
        const range = params.range as string;
        const values = params.values as unknown[];

        if (!spreadsheetId || !range || !values) {
          return {
            success: false,
            error:
              "append_row requires spreadsheetId, range, and values params.",
          };
        }

        try {
          const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [values] },
          });

          return {
            success: true,
            data: {
              updatedRange: response.data.updates?.updatedRange,
              updatedRows: response.data.updates?.updatedRows,
            },
          };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Google Sheets API error: ${message}`,
          };
        }
      }

      case "read_range": {
        const spreadsheetId = params.spreadsheetId as string;
        const range = params.range as string;

        if (!spreadsheetId || !range) {
          return {
            success: false,
            error: "read_range requires spreadsheetId and range params.",
          };
        }

        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
          });

          return {
            success: true,
            data: {
              values: response.data.values || [],
              range: response.data.range,
            },
          };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Google Sheets API error: ${message}`,
          };
        }
      }

      default:
        return {
          success: false,
          error: `Unknown Google Sheets action: "${action}". Supported: append_row, read_range`,
        };
    }
  },
};

registerConnector(googleSheetsConnector);
