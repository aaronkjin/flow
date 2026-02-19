
import type { CopilotDraftWorkflow, CopilotValidationResult } from "./types";

const BRANCHING_TYPES = new Set(["judge", "hitl", "condition"]);

const REQUIRED_CONFIG_KEYS: Record<string, string[]> = {
  trigger: ["triggerType"],
  llm: ["model", "systemPrompt", "userPrompt"],
  judge: ["inputStepId", "criteria", "threshold"],
  hitl: ["instructions", "showSteps"],
  connector: ["connectorType", "action"],
  condition: ["expression"],
  agent: ["model", "systemPrompt", "taskPrompt"],
  "sub-workflow": ["workflowId"],
};

export function validateCopilotDraft(
  draft: CopilotDraftWorkflow
): CopilotValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stepIds = new Set(draft.steps.map((s) => s.id));

  const triggerCount = draft.steps.filter((s) => s.type === "trigger").length;
  if (triggerCount === 0) {
    errors.push("Workflow must have exactly one trigger step (found 0)");
  } else if (triggerCount > 1) {
    errors.push(
      `Workflow must have exactly one trigger step (found ${triggerCount})`
    );
  }

  if (draft.steps.length < 2) {
    errors.push("Workflow must have at least 2 steps");
  }

  const seenIds = new Set<string>();
  for (const step of draft.steps) {
    if (seenIds.has(step.id)) {
      errors.push(`Duplicate step ID: '${step.id}'`);
    }
    seenIds.add(step.id);
  }

  for (const edge of draft.edges) {
    if (!stepIds.has(edge.source)) {
      errors.push(
        `Edge source '${edge.source}' does not reference an existing step`
      );
    }
    if (!stepIds.has(edge.target)) {
      errors.push(
        `Edge target '${edge.target}' does not reference an existing step`
      );
    }
  }

  const cycle = detectCycle(draft);
  if (cycle) {
    errors.push(`Graph contains a cycle: ${cycle.join(" -> ")}`);
  }

  for (const step of draft.steps) {
    if (step.config.type !== step.type) {
      warnings.push(
        `Step '${step.id}': config.type '${step.config.type ?? "undefined"}' does not match step type '${step.type}' — coerced`
      );
      step.config.type = step.type;
    }
  }

  for (const step of draft.steps) {
    const requiredKeys = REQUIRED_CONFIG_KEYS[step.type];
    if (requiredKeys) {
      for (const key of requiredKeys) {
        const value = step.config[key];
        if (value === undefined || value === null) {
          errors.push(
            `Step '${step.id}' (${step.type}): missing required config key '${key}'`
          );
        } else if (key === "criteria" && Array.isArray(value) && value.length === 0) {
          errors.push(
            `Step '${step.id}' (judge): 'criteria' must have at least one criterion`
          );
        } else if (key === "showSteps" && Array.isArray(value) && value.length === 0) {
          warnings.push(
            `Step '${step.id}' (hitl): 'showSteps' is empty — reviewer won't see any prior outputs`
          );
        }
      }
    }
  }

  for (const step of draft.steps) {
    if (step.type === "judge") {
      const inputStepId = step.config.inputStepId as string | undefined;
      if (inputStepId && !stepIds.has(inputStepId)) {
        errors.push(
          `Step '${step.id}' (judge): inputStepId '${inputStepId}' does not reference an existing step`
        );
      }
    }
  }

  for (const step of draft.steps) {
    if (step.type === "hitl") {
      const showSteps = step.config.showSteps as string[] | undefined;
      if (Array.isArray(showSteps)) {
        for (const sid of showSteps) {
          if (!stepIds.has(sid)) {
            errors.push(
              `Step '${step.id}' (hitl): showSteps references non-existent step '${sid}'`
            );
          }
        }
      }
    }
  }


  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();
  for (const edge of draft.edges) {
    hasIncoming.add(edge.target);
    hasOutgoing.add(edge.source);
  }
  for (const step of draft.steps) {
    if (step.type === "trigger") continue;
    if (!hasIncoming.has(step.id) && !hasOutgoing.has(step.id)) {
      warnings.push(`Step '${step.id}' ('${step.name}') is orphaned (no edges)`);
    }
  }

  for (const edge of draft.edges) {
    if (edge.label) {
      const sourceStep = draft.steps.find((s) => s.id === edge.source);
      if (sourceStep && !BRANCHING_TYPES.has(sourceStep.type)) {
        warnings.push(
          `Edge from '${edge.source}' has label '${edge.label}' but source is type '${sourceStep.type}' (not a branching node)`
        );
      }
    }
  }

  for (const step of draft.steps) {
    if (step.type === "llm") {
      if (!step.config.systemPrompt || (step.config.systemPrompt as string).trim() === "") {
        warnings.push(`Step '${step.id}' (llm): systemPrompt is empty`);
      }
      if (!step.config.userPrompt || (step.config.userPrompt as string).trim() === "") {
        warnings.push(`Step '${step.id}' (llm): userPrompt is empty`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}


function detectCycle(draft: CopilotDraftWorkflow): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const step of draft.steps) {
    adjacency.set(step.id, []);
  }
  for (const edge of draft.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const WHITE = 0;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const step of draft.steps) {
    color.set(step.id, WHITE);
    parent.set(step.id, null);
  }

  for (const step of draft.steps) {
    if (color.get(step.id) === WHITE) {
      const cycle = dfs(step.id, adjacency, color, parent);
      if (cycle) return cycle;
    }
  }

  return null;
}

function dfs(
  node: string,
  adjacency: Map<string, string[]>,
  color: Map<string, number>,
  parent: Map<string, string | null>
): string[] | null {
  color.set(node, 1);

  for (const neighbor of adjacency.get(node) ?? []) {
    if (color.get(neighbor) === 1) {
      const cycle = [neighbor, node];
      let current = node;
      while (current !== neighbor) {
        current = parent.get(current)!;
        if (current === null) break;
        cycle.push(current);
      }
      return cycle.reverse();
    }
    if (color.get(neighbor) === 0) {
      parent.set(neighbor, node);
      const result = dfs(neighbor, adjacency, color, parent);
      if (result) return result;
    }
  }

  color.set(node, 2);
  return null;
}
