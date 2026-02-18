import type { Connector, ConnectorResult } from "@/lib/engine/types";
import { registerConnector } from "@/lib/connectors/registry";

const httpConnector: Connector = {
  type: "http",

  async execute(action: string, params: Record<string, unknown>): Promise<ConnectorResult> {
    if (action !== "request") {
      return { success: false, error: `Unknown HTTP action: "${action}". Supported: request` };
    }

    const url = params.url as string | undefined;
    if (!url) {
      return { success: false, error: "URL is required for HTTP connector" };
    }

    const method = ((params.method as string) || "POST").toUpperCase();
    const authType = (params.authType as string) || "none";
    const authToken = params.authToken as string | undefined;

    const headers: Record<string, string> = {};

    if (params.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (authType === "bearer" && authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    } else if (authType === "api-key" && authToken) {
      headers["X-API-Key"] = authToken;
    }

    if (params.headers && typeof params.headers === "object") {
      Object.assign(headers, params.headers);
    }

    let bodyStr: string | undefined;
    if (params.body !== undefined) {
      bodyStr = typeof params.body === "string" ? params.body : JSON.stringify(params.body);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
      });

      let parsedBody: unknown;
      const responseText = await response.text();
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText;
      }

      if (!response.ok) {
        const truncated = responseText.length > 200 ? responseText.slice(0, 200) + "…" : responseText;
        return {
          success: false,
          error: `HTTP ${response.status}: ${truncated}`,
          data: { status: response.status, body: parsedBody },
        };
      }

      return { success: true, data: { status: response.status, body: parsedBody } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `HTTP request failed: ${message}` };
    }
  },
};

registerConnector(httpConnector);
