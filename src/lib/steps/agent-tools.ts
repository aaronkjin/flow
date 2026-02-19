import type { AgentToolRef } from "@/lib/engine/types";
import type { ToolDefinition, ToolExecutionResult } from "@/lib/tools/types";
import { getTool, registerTool } from "@/lib/tools/registry";

export function resolveAgentTools(refs: AgentToolRef[]): ToolDefinition[] {
  const resolved: ToolDefinition[] = [];

  for (const ref of refs) {
    switch (ref.type) {
      case "connector": {
        if (!ref.connectorType || !ref.action) {
          console.warn(
            `[agent-tools] Connector ref missing connectorType or action, skipping`
          );
          break;
        }
        const toolName = `${ref.connectorType}_${ref.action}`.replace(
          /-/g,
          "_"
        );
        const tool = getTool(toolName);
        if (tool) {
          resolved.push(tool.definition);
        } else {
          console.warn(
            `[agent-tools] Connector tool "${toolName}" not found in registry, skipping`
          );
        }
        break;
      }

      case "sub_workflow": {
        if (!ref.workflowId) {
          console.warn(
            `[agent-tools] Sub-workflow ref missing workflowId, skipping`
          );
          break;
        }
        const toolName = `workflow_${ref.workflowId}`;
        const tool = getTool(toolName);
        if (tool) {
          resolved.push(tool.definition);
        } else {
          console.warn(
            `[agent-tools] Workflow tool "${toolName}" not found in registry, skipping`
          );
        }
        break;
      }

      case "custom_function": {
        if (!ref.functionName) {
          console.warn(
            `[agent-tools] Custom function ref missing functionName, skipping`
          );
          break;
        }

        const definition: ToolDefinition = {
          name: ref.functionName,
          description: ref.functionDescription || ref.functionName,
          category: "custom",
          parameters: (ref.functionParameters as unknown as ToolDefinition["parameters"]) || {
            type: "object",
            properties: {},
          },
        };

        if (!getTool(ref.functionName)) {
          registerTool({
            definition,
            execute: async (
              params: Record<string, unknown>
            ): Promise<ToolExecutionResult> => {
              return {
                success: true,
                data: params,
                executionTimeMs: 0,
              };
            },
          });
        }

        resolved.push(definition);
        break;
      }

      default:
        console.warn(
          `[agent-tools] Unknown tool ref type: "${(ref as AgentToolRef).type}", skipping`
        );
    }
  }

  return resolved;
}
