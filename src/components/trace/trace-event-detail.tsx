"use client";

import { Badge } from "@/components/ui/badge";
import type { TraceEvent } from "@/lib/engine/types";

function LLMCallDetail({ data }: { data: Record<string, unknown> }) {
  const model = data.model as string | undefined;
  const usage = data.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
  const prompt = (data.userPrompt || data.prompt) as string | undefined;
  const preview = (prompt || "").slice(0, 200);

  return (
    <div className="space-y-2 text-sm">
      {model && <p><span className="font-medium">Model:</span> {model}</p>}
      {preview && (
        <div>
          <span className="font-medium">Prompt:</span>
          <p className="mt-1 text-muted-foreground/70 whitespace-pre-wrap">{preview}{(prompt || "").length > 200 ? "..." : ""}</p>
        </div>
      )}
      {usage && (
        <p>
          <span className="font-medium">Tokens:</span>{" "}
          {usage.promptTokens ?? 0} prompt + {usage.completionTokens ?? 0} completion = {usage.totalTokens ?? 0} total
        </p>
      )}
    </div>
  );
}

function JudgeResultDetail({ data }: { data: Record<string, unknown> }) {
  const recommendation = data.recommendation as string | undefined;
  const confidence = data.overallConfidence as number | undefined;
  const criteriaScores = data.criteriaScores as Record<string, number> | undefined;
  const issues = data.issues as string[] | undefined;

  return (
    <div className="space-y-2 text-sm">
      {recommendation && (
        <div className="flex items-center gap-2">
          <span className="font-medium">Recommendation:</span>
          <Badge
            variant="outline"
            className={
              recommendation === "pass"
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : recommendation === "flag"
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : "bg-rose-50 text-rose-600 border-rose-200"
            }
          >
            {recommendation}
          </Badge>
        </div>
      )}
      {confidence !== undefined && (
        <p><span className="font-medium">Confidence:</span> {Math.round(confidence * 100)}%</p>
      )}
      {criteriaScores && Object.keys(criteriaScores).length > 0 && (
        <div>
          <span className="font-medium">Criteria:</span>
          <ul className="mt-1 list-disc list-inside text-muted-foreground/70">
            {Object.entries(criteriaScores).map(([name, score]) => (
              <li key={name}>{name}: {Math.round(score * 100)}%</li>
            ))}
          </ul>
        </div>
      )}
      {issues && issues.length > 0 && (
        <div>
          <span className="font-medium">Issues:</span>
          <ul className="mt-1 list-disc list-inside text-muted-foreground/70">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConnectorDetail({ data }: { data: Record<string, unknown> }) {
  const connectorType = data.connectorType as string | undefined;
  const action = data.action as string | undefined;
  const success = data.success as boolean | undefined;

  return (
    <div className="space-y-1 text-sm">
      {connectorType && <p><span className="font-medium">Connector:</span> {connectorType}</p>}
      {action && <p><span className="font-medium">Action:</span> {action}</p>}
      {success !== undefined && (
        <p><span className="font-medium">Status:</span> {success ? "Success" : "Failed"}</p>
      )}
    </div>
  );
}

function AgentIterationDetail({ data }: { data: Record<string, unknown> }) {
  const iterIndex = data.iterationIndex as number | undefined;
  const reasoning = data.reasoning as string | undefined;
  const toolName = data.toolName as string | undefined;
  const toolCount = data.toolCount as number | undefined;
  const success = data.success as boolean | undefined;
  const error = data.error as string | undefined;
  const tokensUsed = data.tokensUsed as { prompt?: number; completion?: number } | undefined;
  const args = data.arguments as Record<string, unknown> | undefined;
  const result = data.result as unknown;

  return (
    <div className="space-y-2 text-sm">
      {iterIndex !== undefined && (
        <p><span className="font-medium">Iteration:</span> {iterIndex + 1}</p>
      )}
      {reasoning && (
        <div>
          <span className="font-medium">Reasoning:</span>
          <p className="mt-1 text-muted-foreground/70 whitespace-pre-wrap">
            {reasoning.slice(0, 300)}{reasoning.length > 300 ? "..." : ""}
          </p>
        </div>
      )}
      {toolName && (
        <p>
          <span className="font-medium">Tool:</span> {toolName}
          {toolCount && toolCount > 1 ? ` (+${toolCount - 1} more)` : ""}
        </p>
      )}
      {args && (
        <div>
          <span className="font-medium">Arguments:</span>
          <pre className="mt-1 text-xs bg-muted/30 p-2 rounded overflow-auto max-h-32 font-mono">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
      {success !== undefined && (
        <p><span className="font-medium">Result:</span> {success ? "Success" : "Failed"}</p>
      )}
      {result != null && (
        <div>
          <span className="font-medium">Output:</span>
          <pre className="mt-1 text-xs bg-muted/30 p-2 rounded overflow-auto max-h-32 font-mono">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      {error && (
        <p className="text-rose-600"><span className="font-medium">Error:</span> {error}</p>
      )}
      {tokensUsed && (
        <p>
          <span className="font-medium">Tokens:</span>{" "}
          {tokensUsed.prompt ?? 0} prompt + {tokensUsed.completion ?? 0} completion
        </p>
      )}
    </div>
  );
}

function AgentCompleteDetail({ data }: { data: Record<string, unknown> }) {
  const stopReason = data.stopReason as string | undefined;
  const totalIterations = data.totalIterations as number | undefined;
  const totalUsage = data.totalUsage as {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | undefined;
  const model = data.model as string | undefined;
  const result = data.result as unknown;

  return (
    <div className="space-y-2 text-sm">
      {stopReason && (
        <p><span className="font-medium">Stop Reason:</span> {stopReason}</p>
      )}
      {totalIterations !== undefined && (
        <p><span className="font-medium">Total Iterations:</span> {totalIterations}</p>
      )}
      {model && <p><span className="font-medium">Model:</span> {model}</p>}
      {totalUsage && (
        <p>
          <span className="font-medium">Total Tokens:</span>{" "}
          {totalUsage.promptTokens ?? 0} prompt + {totalUsage.completionTokens ?? 0} completion = {totalUsage.totalTokens ?? 0} total
        </p>
      )}
      {result != null && (
        <div>
          <span className="font-medium">Result:</span>
          <pre className="mt-1 text-xs bg-muted/30 p-2 rounded overflow-auto max-h-40 font-mono">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function SubWorkflowDetail({ data }: { data: Record<string, unknown> }) {
  const workflowName = data.workflowName as string | undefined;
  const workflowId = data.workflowId as string | undefined;
  const childRunId = data.childRunId as string | undefined;

  return (
    <div className="space-y-1 text-sm">
      {workflowName && <p><span className="font-medium">Workflow:</span> {workflowName}</p>}
      {workflowId && <p><span className="font-medium">Workflow ID:</span> {workflowId}</p>}
      {childRunId && <p><span className="font-medium">Child Run ID:</span> {childRunId}</p>}
    </div>
  );
}

export function TraceEventDetail({ event }: { event: TraceEvent }) {
  switch (event.type) {
    case "llm_call":
      return <LLMCallDetail data={event.data} />;
    case "judge_result":
      return <JudgeResultDetail data={event.data} />;
    case "connector_fired":
      return <ConnectorDetail data={event.data} />;
    case "agent_iteration":
    case "agent_tool_call":
      return <AgentIterationDetail data={event.data} />;
    case "agent_complete":
      return <AgentCompleteDetail data={event.data} />;
    case "sub_workflow_started":
    case "sub_workflow_completed":
      return <SubWorkflowDetail data={event.data} />;
    default:
      return (
        <pre className="text-xs bg-muted/30 p-3 rounded-lg overflow-auto max-h-60 font-mono">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      );
  }
}
