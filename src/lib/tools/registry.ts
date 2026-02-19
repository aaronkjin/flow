import type { Tool, ToolDefinition, ToolCategory } from "./types";
import { createConnectorTools } from "./connector-adapter";
import { builtinTools } from "./builtin-tools";

const tools = new Map<string, Tool>();

export function registerTool(tool: Tool): void {
  if (tools.has(tool.definition.name)) {
    console.warn(
      `[tool-registry] Overwriting existing tool: "${tool.definition.name}"`
    );
  }
  tools.set(tool.definition.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

export function listTools(filter?: {
  category?: ToolCategory;
}): ToolDefinition[] {
  const all = Array.from(tools.values()).map((t) => t.definition);
  if (filter?.category) {
    return all.filter((d) => d.category === filter.category);
  }
  return all;
}

export function listToolsForAgent(
  allowedToolNames?: string[]
): ToolDefinition[] {
  if (allowedToolNames) {
    return allowedToolNames
      .map((name) => tools.get(name)?.definition)
      .filter((d): d is ToolDefinition => d !== undefined);
  }
  return listTools();
}

export function initializeTools(): void {
  for (const tool of createConnectorTools()) {
    registerTool(tool);
  }
  for (const tool of builtinTools) {
    registerTool(tool);
  }
}

export function registerWorkflowTool(
  workflowId: string,
  name: string,
  description: string,
  inputSchema: ToolDefinition["parameters"],
  executeFn: Tool["execute"]
): void {
  registerTool({
    definition: {
      name,
      description,
      category: "sub_workflow",
      parameters: inputSchema,
      workflowRef: { workflowId },
    },
    execute: executeFn,
  });
}
