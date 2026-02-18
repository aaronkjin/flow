import type { Connector, ConnectorResult } from "@/lib/engine/types";
import { registerConnector } from "@/lib/connectors/registry";

const slackConnector: Connector = {
  type: "slack",

  async execute(action: string, params: Record<string, unknown>): Promise<ConnectorResult> {
    if (action !== "send_message") {
      return { success: false, error: `Unknown Slack action: "${action}". Supported: send_message` };
    }

    const webhookUrl =
      (params.webhookUrl as string | undefined) || process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        success: false,
        error: "No Slack webhook URL configured. Set SLACK_WEBHOOK_URL env var or provide webhookUrl in params.",
      };
    }

    const body: Record<string, unknown> = { text: params.text };
    if (params.channel !== undefined) body.channel = params.channel;
    if (params.username !== undefined) body.username = params.username;
    if (params.icon_emoji !== undefined) body.icon_emoji = params.icon_emoji;

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Slack webhook failed: ${response.status} ${text}` };
      }

      return { success: true, data: { message: "Message sent" } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Slack webhook failed: ${message}` };
    }
  },
};

registerConnector(slackConnector);
