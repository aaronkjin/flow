
import { v4 as uuidv4 } from "uuid";
import dagre from "@dagrejs/dagre";
import type { StepType, StepConfig } from "@/lib/engine/types";
import type { CopilotDraftWorkflow, CopilotCompileResult } from "./types";

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  trigger: { type: "trigger", triggerType: "manual" },
  llm: {
    type: "llm",
    model: "gpt-4o-mini",
    systemPrompt: "",
    userPrompt: "",
    temperature: 0.7,
    responseFormat: "text",
  },
  judge: {
    type: "judge",
    inputStepId: "",
    criteria: [],
    threshold: 0.8,
    model: "gpt-4o-mini",
  },
  hitl: {
    type: "hitl",
    instructions: "",
    showSteps: [],
    autoApproveOnJudgePass: false,
  },
  connector: {
    type: "connector",
    connectorType: "slack",
    action: "send_message",
    params: {},
  },
  condition: { type: "condition", expression: "" },
  agent: {
    type: "agent",
    model: "gpt-4o-mini",
    systemPrompt:
      "You are a helpful agent that completes tasks using the available tools.",
    taskPrompt: "",
    tools: [],
    maxIterations: 10,
    temperature: 0.3,
    hitlOnLowConfidence: false,
    confidenceThreshold: 0.5,
  },
  "sub-workflow": {
    type: "sub-workflow",
    workflowId: "",
    inputMapping: {},
  },
};

function layoutGraph(
  nodes: CopilotCompileResult["nodes"],
  edges: CopilotCompileResult["edges"]
): CopilotCompileResult["nodes"] {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => g.setNode(node.id, { width: 200, height: 80 }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 100, y: pos.y - 40 } };
  });
}

function remapConfigIds(
  config: Record<string, unknown>,
  idMap: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      if (
        (key === "inputStepId" || key === "judgeStepId" || key === "reviewTargetStepId") &&
        idMap.has(value)
      ) {
        result[key] = idMap.get(value)!;
      } else {
        result[key] = value.replace(
          /\{\{steps\.([a-zA-Z0-9_-]+)\./g,
          (_match, stepId: string) => {
            const newId = idMap.get(stepId);
            return newId ? `{{steps.${newId}.` : _match;
          }
        );
      }
    } else if (
      key === "showSteps" &&
      Array.isArray(value)
    ) {
      result[key] = (value as string[]).map((id) => idMap.get(id) ?? id);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = remapConfigIds(value as Record<string, unknown>, idMap);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function compileCopilotDraft(
  draft: CopilotDraftWorkflow
): CopilotCompileResult {
  const idMap = new Map<string, string>();
  for (const step of draft.steps) {
    idMap.set(step.id, uuidv4());
  }

  const nodes: CopilotCompileResult["nodes"] = draft.steps.map((step) => {
    const newId = idMap.get(step.id)!;
    const defaults = DEFAULT_CONFIGS[step.type] ?? {};
    const mergedConfig = remapConfigIds({ ...defaults, ...step.config }, idMap);

    return {
      id: newId,
      type: step.type as StepType,
      position: { x: 0, y: 0 },
      data: {
        label: step.name,
        stepType: step.type as StepType,
        config: mergedConfig as unknown as StepConfig,
      },
    };
  });

  const edges: CopilotCompileResult["edges"] = draft.edges.map((edge) => ({
    id: uuidv4(),
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
    sourceHandle: edge.label ?? undefined,
    label: edge.label,
    type: "workflow",
    animated: true,
  }));

  const layoutedNodes = layoutGraph(nodes, edges);

  return {
    nodes: layoutedNodes,
    edges,
    workflowName: draft.title,
    workflowDescription: draft.description ?? "",
  };
}
