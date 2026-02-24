import type { Connector, ConnectorResult } from "@/lib/engine/types";
import { registerConnector } from "@/lib/connectors/registry";

const emailConnector: Connector = {
  type: "email",

  async execute(action: string, params: Record<string, unknown>): Promise<ConnectorResult> {
    if (action !== "send_email") {
      return { success: false, error: `Unknown email action: "${action}". Supported: send_email` };
    }

    const apiKey =
      (params.apiKey as string | undefined) || process.env.RESEND_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: "No Resend API key configured. Set RESEND_API_KEY env var or provide apiKey in params.",
      };
    }

    const from = (params.from as string) || "Flow <onboarding@resend.dev>";
    const body: Record<string, unknown> = {
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    };
    if (params.replyTo !== undefined) {
      body.reply_to = params.replyTo;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Resend API error: ${response.status} ${text}` };
      }

      const data = await response.json();
      return { success: true, data: { emailId: data.id } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Resend API error: ${message}` };
    }
  },
};

registerConnector(emailConnector);
