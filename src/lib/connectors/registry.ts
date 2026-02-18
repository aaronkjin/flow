import type { Connector } from "@/lib/engine/types";

const registry = new Map<string, Connector>();

export function registerConnector(connector: Connector): void {
  registry.set(connector.type, connector);
}

export function getConnector(type: string): Connector | undefined {
  return registry.get(type);
}

export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}
