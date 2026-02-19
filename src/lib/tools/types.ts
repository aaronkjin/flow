export type ToolCategory = "connector" | "sub_workflow" | "custom" | "builtin";

export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
      items?: { type: string };
    }
  >;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameterSchema;
  returns?: ToolParameterSchema;
  connectorRef?: { connectorType: string; action: string };
  workflowRef?: { workflowId: string };
}

export interface ToolExecutionContext {
  runId: string;
  stepId: string;
  credentials: Record<string, string>;
}

export interface ToolExecutionResult {
  success: boolean;
  data: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface Tool {
  definition: ToolDefinition;
  execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
}
