import type { InterpolationContext } from "@/lib/engine/types";
import { getConnector, getRegisteredTypes } from "@/lib/connectors/registry";
import "@/lib/connectors";

export async function executeConnectorStep(
  config: Record<string, unknown>,
  context: InterpolationContext
): Promise<Record<string, unknown>> {
  void context;

  const connectorType = config.connectorType as string;
  const action = config.action as string;
  const params = (config.params as Record<string, unknown>) ?? {};

  const connector = getConnector(connectorType);
  if (!connector) {
    throw new Error(
      `Connector "${connectorType}" is not registered. Available types: ${getRegisteredTypes().join(", ") || "none"}`
    );
  }

  let result;
  try {
    result = await connector.execute(action, params);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Connector "${connectorType}" failed on action "${action}": ${message}`
    );
  }

  if (!result.success) {
    throw new Error(result.error ?? `Connector "${connectorType}" action "${action}" failed`);
  }

  return {
    connectorType,
    action,
    success: true,
    ...result.data,
  };
}
