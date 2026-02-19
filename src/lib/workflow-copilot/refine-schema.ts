
import type { CopilotOperation, CopilotDraftStep } from "./types";

const VALID_OPS = [
  "add_step",
  "remove_step",
  "update_step_config",
  "rename_step",
  "add_edge",
  "remove_edge",
] as const;

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

const MAX_OPERATIONS = 15;

export const REFINE_OPERATIONS_SCHEMA = {
  type: "object",
  required: ["operations"],
  properties: {
    operations: {
      type: "array",
      maxItems: MAX_OPERATIONS,
      items: {
        type: "object",
        required: ["op"],
        properties: {
          op: {
            type: "string",
            enum: [...VALID_OPS],
          },
        },
      },
    },
  },
} as const;

export function parseRefineOperations(raw: string): CopilotOperation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON: could not parse refine response as JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Refine response must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.operations)) {
    throw new Error("'operations' must be an array");
  }

  if (obj.operations.length > MAX_OPERATIONS) {
    throw new Error(
      `Too many operations (${obj.operations.length}). Maximum is ${MAX_OPERATIONS}.`
    );
  }

  const errors: string[] = [];
  const operations: CopilotOperation[] = [];

  for (let i = 0; i < obj.operations.length; i++) {
    const op = obj.operations[i] as Record<string, unknown>;
    const prefix = `operations[${i}]`;

    if (!op.op || typeof op.op !== "string") {
      errors.push(`${prefix}: missing or invalid 'op' field`);
      continue;
    }

    if (!(VALID_OPS as readonly string[]).includes(op.op)) {
      errors.push(
        `${prefix}: unknown op '${op.op}'. Valid ops: ${VALID_OPS.join(", ")}`
      );
      continue;
    }

    switch (op.op) {
      case "add_step": {
        const step = op.step as Record<string, unknown> | undefined;
        if (!step || typeof step !== "object" || Array.isArray(step)) {
          errors.push(`${prefix}: add_step requires a 'step' object`);
          break;
        }
        if (!step.id || typeof step.id !== "string") {
          errors.push(`${prefix}: step.id is required and must be a string`);
          break;
        }
        if (
          !step.type ||
          typeof step.type !== "string" ||
          !(VALID_STEP_TYPES as readonly string[]).includes(step.type)
        ) {
          errors.push(
            `${prefix}: step.type must be one of: ${VALID_STEP_TYPES.join(", ")}`
          );
          break;
        }
        if (!step.name || typeof step.name !== "string") {
          errors.push(`${prefix}: step.name is required`);
          break;
        }
        if (
          !step.config ||
          typeof step.config !== "object" ||
          Array.isArray(step.config)
        ) {
          errors.push(`${prefix}: step.config must be an object`);
          break;
        }
        operations.push({
          op: "add_step",
          step: step as unknown as CopilotDraftStep,
          afterStepId:
            typeof op.afterStepId === "string" ? op.afterStepId : undefined,
        });
        break;
      }

      case "remove_step": {
        if (!op.stepId || typeof op.stepId !== "string") {
          errors.push(`${prefix}: remove_step requires 'stepId' string`);
          break;
        }
        operations.push({ op: "remove_step", stepId: op.stepId });
        break;
      }

      case "update_step_config": {
        if (!op.stepId || typeof op.stepId !== "string") {
          errors.push(
            `${prefix}: update_step_config requires 'stepId' string`
          );
          break;
        }
        if (
          !op.configPatch ||
          typeof op.configPatch !== "object" ||
          Array.isArray(op.configPatch)
        ) {
          errors.push(
            `${prefix}: update_step_config requires 'configPatch' object`
          );
          break;
        }
        operations.push({
          op: "update_step_config",
          stepId: op.stepId as string,
          configPatch: op.configPatch as Record<string, unknown>,
        });
        break;
      }

      case "rename_step": {
        if (!op.stepId || typeof op.stepId !== "string") {
          errors.push(`${prefix}: rename_step requires 'stepId' string`);
          break;
        }
        if (!op.name || typeof op.name !== "string") {
          errors.push(`${prefix}: rename_step requires 'name' string`);
          break;
        }
        operations.push({
          op: "rename_step",
          stepId: op.stepId,
          name: op.name,
        });
        break;
      }

      case "add_edge": {
        if (!op.source || typeof op.source !== "string") {
          errors.push(`${prefix}: add_edge requires 'source' string`);
          break;
        }
        if (!op.target || typeof op.target !== "string") {
          errors.push(`${prefix}: add_edge requires 'target' string`);
          break;
        }
        operations.push({
          op: "add_edge",
          source: op.source,
          target: op.target,
          label: typeof op.label === "string" ? op.label : undefined,
        });
        break;
      }

      case "remove_edge": {
        if (!op.source || typeof op.source !== "string") {
          errors.push(`${prefix}: remove_edge requires 'source' string`);
          break;
        }
        if (!op.target || typeof op.target !== "string") {
          errors.push(`${prefix}: remove_edge requires 'target' string`);
          break;
        }
        operations.push({
          op: "remove_edge",
          source: op.source,
          target: op.target,
        });
        break;
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Operation parsing errors:\n${errors.join("\n")}`);
  }

  return operations;
}
