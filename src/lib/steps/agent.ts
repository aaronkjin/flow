import OpenAI from "openai";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import type {
  InterpolationContext,
  AgentStepConfig,
  AgentIteration,
  TraceEvent,
} from "@/lib/engine/types";
import type { ToolExecutionContext } from "@/lib/tools/types";
import { resolveAgentTools } from "./agent-tools";
import { toOpenAITools, executeAllToolCalls } from "@/lib/tools/openai-format";
import { initializeTools } from "@/lib/tools/registry";

export async function executeAgentStep(
  config: Record<string, unknown>,
  context: InterpolationContext,
  emitTrace?: (event: Omit<TraceEvent, "id" | "runId" | "timestamp">) => void
): Promise<Record<string, unknown>> {
  void context;

  const model = (config.model as string) || "gpt-4o-mini";
  const systemPrompt = (config.systemPrompt as string) || "You are a helpful agent.";
  const taskPrompt = (config.taskPrompt as string) || "";
  const toolRefs = (config.tools as AgentStepConfig["tools"]) || [];
  const maxIterations = (config.maxIterations as number) || 10;
  const temperature = (config.temperature as number) ?? 0.3;
  const hitlOnLowConfidence = (config.hitlOnLowConfidence as boolean) ?? false;
  const confidenceThreshold = (config.confidenceThreshold as number) ?? 0.5;
  const outputSchema = config.outputSchema as Record<string, unknown> | undefined;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  initializeTools();

  const toolDefs = resolveAgentTools(toolRefs);

  const openaiTools = toOpenAITools(toolDefs);

  if (outputSchema) {
    openaiTools.push({
      type: "function",
      function: {
        name: "submit_result",
        description:
          "Submit your final structured result when the task is complete.",
        parameters: outputSchema,
      },
    });
  }

  let systemSuffix = outputSchema
    ? "\n\nWhen you have completed the task, call the submit_result tool with your final answer."
    : "\n\nWhen you have completed the task, respond with your final answer (no tool call).";

  if (hitlOnLowConfidence) {
    systemSuffix +=
      `\n\nBefore giving your final answer, assess your confidence on a scale of 0 to 1. ` +
      `If your confidence is below ${confidenceThreshold}, include "CONFIDENCE: <number>" ` +
      `(e.g. "CONFIDENCE: 0.3") in your response text to flag this for human review.`;
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt + systemSuffix },
    { role: "user", content: taskPrompt },
  ];

  const iterations: AgentIteration[] = [];
  const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const client = new OpenAI({ apiKey, timeout: 60000 });

  function buildOutput(
    result: Record<string, unknown>,
    stopReason: string
  ): Record<string, unknown> {
    return {
      result,
      iterations,
      totalIterations: iterations.length,
      stopReason,
      totalUsage,
      model,
    };
  }

  function extractConfidence(text: string): number | undefined {
    const match = text.match(/CONFIDENCE:\s*([\d.]+)/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val >= 0 && val <= 1) return val;
    }
    return undefined;
  }

  function shouldEscalateToHitl(text: string): { escalate: boolean; confidence?: number } {
    if (!hitlOnLowConfidence) return { escalate: false };
    const confidence = extractConfidence(text);
    if (confidence !== undefined && confidence < confidenceThreshold) {
      return { escalate: true, confidence };
    }
    return { escalate: false, confidence };
  }

  let lastContent = "";
  for (let i = 0; i < maxIterations; i++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        ...(openaiTools.length > 0
          ? { tools: openaiTools, tool_choice: "auto" as const }
          : {}),
        temperature,
      });

      const choice = response.choices[0];
      const usage = response.usage;

      if (usage) {
        totalUsage.promptTokens += usage.prompt_tokens ?? 0;
        totalUsage.completionTokens += usage.completion_tokens ?? 0;
        totalUsage.totalTokens += usage.total_tokens ?? 0;
      }

      messages.push(choice.message);

      const iterTokens = {
        prompt: usage?.prompt_tokens ?? 0,
        completion: usage?.completion_tokens ?? 0,
      };

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCalls = choice.message.tool_calls.filter(
          (tc): tc is ChatCompletionMessageFunctionToolCall =>
            tc.type === "function"
        );

        const submitCall = toolCalls.find(
          (tc) => tc.function.name === "submit_result"
        );

        if (submitCall) {
          let structuredResult: Record<string, unknown>;
          try {
            structuredResult = JSON.parse(submitCall.function.arguments);
          } catch {
            structuredResult = { raw: submitCall.function.arguments };
          }

          const reasoning = choice.message.content || "";
          const { escalate, confidence } = shouldEscalateToHitl(reasoning);

          iterations.push({
            index: i,
            reasoning,
            toolCall: {
              toolName: "submit_result",
              arguments: structuredResult,
            },
            isComplete: true,
            confidence,
            tokensUsed: iterTokens,
          });

          if (escalate) {
            emitTrace?.({
              type: "agent_complete",
              stepId: "agent",
              stepName: "agent",
              data: {
                stopReason: "hitl_escalation",
                totalIterations: iterations.length,
                totalUsage,
                model,
                confidence,
                result: structuredResult,
              },
            });
            return { __hitlPause: true, ...buildOutput(structuredResult, "hitl_escalation") };
          }

          emitTrace?.({
            type: "agent_complete",
            stepId: "agent",
            stepName: "agent",
            data: {
              stopReason: "submit_result",
              totalIterations: iterations.length,
              totalUsage,
              model,
              result: structuredResult,
            },
          });

          return buildOutput(structuredResult, "submit_result");
        }

        const execContext: ToolExecutionContext = {
          runId: "agent",
          stepId: "agent",
          credentials: {},
        };

        const results = await executeAllToolCalls(
          toolCalls as Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>,
          execContext
        );

        for (const tcResult of results) {
          messages.push(tcResult.responseMessage);

          emitTrace?.({
            type: "agent_tool_call",
            stepId: "agent",
            stepName: "agent",
            data: {
              iterationIndex: i,
              toolName: tcResult.toolName,
              arguments: safeParseJson(
                toolCalls.find((tc) => tc.id === tcResult.toolCallId)?.function
                  .arguments || "{}"
              ),
              success: tcResult.result.success,
              result: tcResult.result.data,
              error: tcResult.result.error,
            },
          });
        }

        const firstTc = toolCalls[0];
        const firstResult = results[0];
        iterations.push({
          index: i,
          reasoning: choice.message.content || "",
          toolCall: {
            toolName: firstTc.function.name,
            arguments: safeParseJson(firstTc.function.arguments),
          },
          toolResult: {
            success: firstResult.result.success,
            output: (firstResult.result.data as Record<string, unknown>) || {},
            error: firstResult.result.error,
          },
          isComplete: false,
          tokensUsed: iterTokens,
        });

        emitTrace?.({
          type: "agent_iteration",
          stepId: "agent",
          stepName: "agent",
          data: {
            iterationIndex: i,
            reasoning: (choice.message.content || "").slice(0, 300),
            toolName: firstTc.function.name,
            toolCount: toolCalls.length,
            tokensUsed: iterTokens,
          },
        });
      } else {
        lastContent = choice.message.content || "";

        let parsedResult: Record<string, unknown>;
        try {
          parsedResult = JSON.parse(lastContent);
        } catch {
          parsedResult = { text: lastContent };
        }

        const { escalate, confidence } = shouldEscalateToHitl(lastContent);

        iterations.push({
          index: i,
          reasoning: lastContent,
          isComplete: true,
          confidence,
          tokensUsed: iterTokens,
        });

        if (escalate) {
          emitTrace?.({
            type: "agent_complete",
            stepId: "agent",
            stepName: "agent",
            data: {
              stopReason: "hitl_escalation",
              totalIterations: iterations.length,
              totalUsage,
              model,
              confidence,
              result: parsedResult,
            },
          });
          return { __hitlPause: true, ...buildOutput(parsedResult, "hitl_escalation") };
        }

        emitTrace?.({
          type: "agent_complete",
          stepId: "agent",
          stepName: "agent",
          data: {
            stopReason: "text_response",
            totalIterations: iterations.length,
            totalUsage,
            model,
            result: parsedResult,
          },
        });

        return buildOutput(parsedResult, "text_response");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      iterations.push({
        index: i,
        reasoning: `Error: ${errorMsg}`,
        isComplete: false,
        tokensUsed: { prompt: 0, completion: 0 },
      });

      emitTrace?.({
        type: "agent_iteration",
        stepId: "agent",
        stepName: "agent",
        data: {
          iterationIndex: i,
          error: errorMsg,
        },
      });

      if (i === 0) {
        throw new Error(`Agent failed on first iteration: ${errorMsg}`);
      }
    }
  }

  emitTrace?.({
    type: "agent_complete",
    stepId: "agent",
    stepName: "agent",
    data: {
      stopReason: "max_iterations",
      totalIterations: iterations.length,
      totalUsage,
      model,
    },
  });

  return buildOutput(
    { text: lastContent || "Max iterations reached without completion" },
    "max_iterations"
  );
}

function safeParseJson(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}
