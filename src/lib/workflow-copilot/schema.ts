
import type { CopilotDraftWorkflow, CopilotDraftStep, CopilotDraftEdge } from "./types";

const VALID_STEP_TYPES = [
  "trigger",
  "llm",
  "judge",
  "hitl",
  "connector",
  "condition",
  "agent",
  "sub-workflow",
] as const;

export const COPILOT_DRAFT_SCHEMA = {
  type: "object",
  required: ["title", "steps", "edges"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type", "name", "config"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...VALID_STEP_TYPES] },
          name: { type: "string" },
          config: { type: "object" },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        required: ["source", "target"],
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          label: { type: "string" },
        },
      },
    },
  },
} as const;

export function parseCopilotDraft(raw: string): CopilotDraftWorkflow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON: could not parse model output as JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Draft must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (!obj.title || typeof obj.title !== "string" || obj.title.trim() === "") {
    errors.push("Missing or empty 'title' field");
  }

  if (!Array.isArray(obj.steps)) {
    errors.push("'steps' must be an array");
  } else {
    if (obj.steps.length < 2) {
      errors.push("Draft must have at least 2 steps");
    }

    let triggerCount = 0;
    for (let i = 0; i < obj.steps.length; i++) {
      const step = obj.steps[i] as Record<string, unknown>;
      const prefix = `steps[${i}]`;

      if (!step.id || typeof step.id !== "string") {
        errors.push(`${prefix}: missing or invalid 'id'`);
      }
      if (!step.name || typeof step.name !== "string") {
        errors.push(`${prefix}: missing or invalid 'name'`);
      }
      if (!step.type || typeof step.type !== "string") {
        errors.push(`${prefix}: missing or invalid 'type'`);
      } else if (
        !(VALID_STEP_TYPES as readonly string[]).includes(step.type)
      ) {
        errors.push(
          `${prefix}: unknown type '${step.type}'. Valid types: ${VALID_STEP_TYPES.join(", ")}`
        );
      }
      if (!step.config || typeof step.config !== "object" || Array.isArray(step.config)) {
        errors.push(`${prefix}: 'config' must be an object`);
      }

      if (step.type === "trigger") triggerCount++;
    }

    if (triggerCount < 1) {
      errors.push("Draft must include at least 1 trigger step");
    }
  }

  if (!Array.isArray(obj.edges)) {
    errors.push("'edges' must be an array");
  } else {
    for (let i = 0; i < obj.edges.length; i++) {
      const edge = obj.edges[i] as Record<string, unknown>;
      const prefix = `edges[${i}]`;

      if (!edge.source || typeof edge.source !== "string") {
        errors.push(`${prefix}: missing or invalid 'source'`);
      }
      if (!edge.target || typeof edge.target !== "string") {
        errors.push(`${prefix}: missing or invalid 'target'`);
      }
    }
  }

  if (obj.description !== undefined && typeof obj.description !== "string") {
    errors.push("'description' must be a string if provided");
  }
  if (obj.assumptions !== undefined) {
    if (!Array.isArray(obj.assumptions)) {
      errors.push("'assumptions' must be an array of strings if provided");
    } else {
      for (let i = 0; i < obj.assumptions.length; i++) {
        if (typeof obj.assumptions[i] !== "string") {
          errors.push(`assumptions[${i}] must be a string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Draft parsing errors:\n${errors.join("\n")}`);
  }

  return {
    title: (obj.title as string).trim(),
    description: obj.description as string | undefined,
    assumptions: obj.assumptions as string[] | undefined,
    steps: obj.steps as CopilotDraftStep[],
    edges: obj.edges as CopilotDraftEdge[],
  };
}
