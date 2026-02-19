
import OpenAI from "openai";
import type {
  CopilotRefineRequest,
  CopilotRefineResponse,
  CopilotDraftWorkflow,
  CopilotDraftStep,
  CopilotDraftEdge,
  CopilotOperation,
} from "./types";
import { parseRefineOperations } from "./refine-schema";
import { applyOperations } from "./apply-operations";
import { validateCopilotDraft } from "./validate-draft";
import { compileCopilotDraft } from "./compile-draft";

const MODEL = "gpt-5.2";

function buildRefineSystemPrompt(): string {
  return `You are a workflow refinement assistant for ActionFlow. The user has an existing workflow and wants to modify it.

## Your Task
Return a JSON object with an "operations" array containing patch operations to apply to the current workflow. Use the MINIMUM number of operations needed.

## Available Operations

1. **add_step** — Add a new step to the workflow
   { "op": "add_step", "step": { "id": "unique_id", "type": "...", "name": "...", "config": {...} }, "afterStepId": "optional_step_id" }

2. **remove_step** — Remove a step (also removes its edges)
   { "op": "remove_step", "stepId": "step_id" }

3. **update_step_config** — Patch a step's config (merged with existing)
   { "op": "update_step_config", "stepId": "step_id", "configPatch": { "key": "value" } }

4. **rename_step** — Change a step's display name
   { "op": "rename_step", "stepId": "step_id", "name": "New Name" }

5. **add_edge** — Add an edge between two steps
   { "op": "add_edge", "source": "source_id", "target": "target_id", "label": "optional_label" }

6. **remove_edge** — Remove an edge between two steps
   { "op": "remove_edge", "source": "source_id", "target": "target_id" }

## Step Types & Config

- **trigger**: { "type": "trigger", "triggerType": "manual" | "dataset" | "webhook" }
- **llm**: { "type": "llm", "model": "gpt-4o-mini", "systemPrompt": "...", "userPrompt": "...", "temperature": 0.7, "responseFormat": "text" | "json" }
- **judge**: { "type": "judge", "inputStepId": "<step_id>", "criteria": [{ "name": "...", "description": "...", "weight": 0.5 }], "threshold": 0.8, "model": "gpt-4o-mini" }
- **hitl**: { "type": "hitl", "instructions": "...", "showSteps": ["<step_id>"], "autoApproveOnJudgePass": false }
- **connector**: { "type": "connector", "connectorType": "slack" | "email" | "http" | "notion" | "google-sheets", "action": "...", "params": {...} }
- **condition**: { "type": "condition", "expression": "..." }
- **agent**: { "type": "agent", "model": "gpt-4o-mini", "systemPrompt": "...", "taskPrompt": "...", "tools": [], "maxIterations": 10, "temperature": 0.3 }
- **sub-workflow**: { "type": "sub-workflow", "workflowId": "", "inputMapping": {} }

## Interpolation
- {{input.fieldName}} — workflow input
- {{steps.stepId.fieldName}} — output from a prior step

## Rules
- Maximum 15 operations per response.
- Always use the step IDs from the current workflow when referencing existing steps.
- New step IDs must be unique and follow the pattern: type_N (e.g., "hitl_2", "llm_3").
- Every step config MUST include a "type" field matching the step type.
- Branching nodes (judge, hitl, condition) use edge labels for routing:
  - judge: "pass", "flag", "fail"
  - hitl: "approve", "reject"
  - condition: "yes", "no"
- Never remove the only trigger step.
- The workflow must always remain a DAG (no cycles).
- Prefer minimal changes — don't recreate the entire workflow.

## Output Format
Return ONLY valid JSON:
{ "operations": [ ... ] }`;
}

function buildRefineUserPrompt(
  message: string,
  currentWorkflow: {
    steps: CopilotDraftStep[];
    edges: CopilotDraftEdge[];
    workflowName?: string;
    workflowDescription?: string;
  }
): string {
  return `Current workflow "${currentWorkflow.workflowName ?? "Untitled"}":

Steps: ${JSON.stringify(currentWorkflow.steps, null, 2)}

Edges: ${JSON.stringify(currentWorkflow.edges, null, 2)}

User request: ${message}

Return the operations to apply as JSON.`;
}

export async function refineWorkflow(
  request: CopilotRefineRequest
): Promise<CopilotRefineResponse> {
  if (!request.message || request.message.trim() === "") {
    throw new Error("Message is required");
  }
  if (
    !request.currentWorkflow ||
    !Array.isArray(request.currentWorkflow.steps) ||
    request.currentWorkflow.steps.length === 0
  ) {
    throw new Error("Current workflow snapshot is required with at least one step");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey, timeout: 30000 });

  const systemPrompt = buildRefineSystemPrompt();
  const userPrompt = buildRefineUserPrompt(
    request.message,
    request.currentWorkflow
  );

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (request.conversationHistory) {
    for (const msg of request.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userPrompt });

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new Error(
      `OpenAI API call failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  let operations: CopilotOperation[];
  try {
    operations = parseRefineOperations(rawContent);
  } catch (err) {
    throw new Error(
      `Failed to parse operations: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  const snapshot: CopilotDraftWorkflow = {
    title: request.currentWorkflow.workflowName ?? "Untitled Workflow",
    description: request.currentWorkflow.workflowDescription,
    steps: request.currentWorkflow.steps,
    edges: request.currentWorkflow.edges,
  };

  let { nextDraft, audit, diffSummary } = applyOperations(
    snapshot,
    operations
  );

  let validation = validateCopilotDraft(nextDraft);

  if (!validation.ok) {
    try {
      const repairMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...messages,
        { role: "assistant", content: rawContent },
        {
          role: "user",
          content: `The operations produced a workflow with validation errors. Please return corrected operations as JSON only:\n\n${validation.errors.join("\n")}`,
        },
      ];

      const repairResponse = await client.chat.completions.create({
        model: MODEL,
        messages: repairMessages,
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const repairContent =
        repairResponse.choices[0]?.message?.content ?? "";
      const repairedOps = parseRefineOperations(repairContent);
      const repaired = applyOperations(snapshot, repairedOps);
      const repairedValidation = validateCopilotDraft(repaired.nextDraft);

      if (
        repairedValidation.ok ||
        repairedValidation.errors.length < validation.errors.length
      ) {
        operations = repairedOps;
        nextDraft = repaired.nextDraft;
        audit = repaired.audit;
        diffSummary = repaired.diffSummary;
        validation = repairedValidation;
      }
    } catch {
    }
  }

  const compiledPreview = compileCopilotDraft(nextDraft);

  return {
    operations,
    audit,
    nextDraft,
    validation,
    compiledPreview,
    diffSummary,
  };
}
