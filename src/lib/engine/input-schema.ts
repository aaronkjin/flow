import type { WorkflowDefinition, TriggerStepConfig } from "./types";

export interface InferredInputField {
  name: string;
  type: "string" | "number" | "text" | "boolean" | "json";
  description?: string;
  required: boolean;
  source: "interpolation" | "manual-field" | "block-config";
}

const NUMBER_KEYWORDS = [
  "count", "amount", "price", "quantity", "score",
  "age", "number", "total", "limit",
];

const TEXT_KEYWORDS = [
  "description", "body", "content", "text", "message",
  "html", "prompt", "instructions", "notes", "details",
];

const BOOLEAN_PREFIXES = ["is_", "has_", "should_"];
const BOOLEAN_KEYWORDS = ["enable", "active", "flag"];

function inferTypeFromFieldName(
  name: string
): InferredInputField["type"] {
  const lower = name.toLowerCase();

  if (NUMBER_KEYWORDS.some((kw) => lower.includes(kw))) return "number";
  if (TEXT_KEYWORDS.some((kw) => lower.includes(kw))) return "text";
  if (
    BOOLEAN_PREFIXES.some((p) => lower.startsWith(p)) ||
    BOOLEAN_KEYWORDS.some((kw) => lower.includes(kw))
  ) {
    return "boolean";
  }

  return "string";
}

export function inferInputSchema(
  workflow: WorkflowDefinition
): InferredInputField[] {
  const map = new Map<string, InferredInputField>();

  const regex = /\{\{input\.([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

  for (const step of workflow.steps) {
    const configStr = JSON.stringify(step.config);
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(configStr)) !== null) {
      const fullPath = match[1];
      const topLevel = fullPath.split(".")[0];
      if (!map.has(topLevel)) {
        map.set(topLevel, {
          name: topLevel,
          type: inferTypeFromFieldName(topLevel),
          required: true,
          source: "interpolation",
        });
      }
    }
  }

  for (const step of workflow.steps) {
    if (step.type === "trigger") {
      const triggerConfig = step.config as TriggerStepConfig;
      if (triggerConfig.manualFields) {
        for (const field of triggerConfig.manualFields) {
          if (!map.has(field.name)) {
            map.set(field.name, {
              name: field.name,
              type: field.type === "text" ? "text" : field.type === "number" ? "number" : "string",
              required: true,
              source: "manual-field",
            });
          }
        }
      }
    }
  }

  if (workflow.blockConfig?.inputSchema) {
    for (const field of workflow.blockConfig.inputSchema) {
      const existing = map.get(field.name);
      if (existing) {
        existing.type = field.type;
        existing.required = field.required;
        if (field.description) {
          existing.description = field.description;
        }
      } else {
        map.set(field.name, {
          name: field.name,
          type: field.type,
          description: field.description,
          required: field.required,
          source: "block-config",
        });
      }
    }
  }

  return Array.from(map.values());
}
