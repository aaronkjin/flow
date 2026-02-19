import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutionContext,
} from "./types";
import { getTool } from "./registry";

export function toOpenAITools(
  definitions: ToolDefinition[]
): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return definitions.map((def) => ({
    type: "function" as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters as unknown as Record<string, unknown>,
    },
  }));
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  result: ToolExecutionResult;
  responseMessage: { role: "tool"; tool_call_id: string; content: string };
}

export async function executeToolCall(
  toolCall: OpenAIToolCall,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  const toolName = toolCall.function.name;
  const tool = getTool(toolName);

  if (!tool) {
    const result: ToolExecutionResult = {
      success: false,
      data: null,
      error: `Unknown tool: "${toolName}"`,
      executionTimeMs: 0,
    };
    return {
      toolCallId: toolCall.id,
      toolName,
      result,
      responseMessage: {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      },
    };
  }

  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    const result: ToolExecutionResult = {
      success: false,
      data: null,
      error: `Malformed JSON in tool call arguments: ${toolCall.function.arguments}`,
      executionTimeMs: 0,
    };
    return {
      toolCallId: toolCall.id,
      toolName,
      result,
      responseMessage: {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      },
    };
  }

  let result: ToolExecutionResult;
  try {
    result = await tool.execute(parsedArgs, context);
  } catch (err) {
    result = {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      executionTimeMs: 0,
    };
  }

  return {
    toolCallId: toolCall.id,
    toolName,
    result,
    responseMessage: {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    },
  };
}

export async function executeAllToolCalls(
  toolCalls: OpenAIToolCall[],
  context: ToolExecutionContext
): Promise<ToolCallResult[]> {
  return Promise.all(toolCalls.map((tc) => executeToolCall(tc, context)));
}
