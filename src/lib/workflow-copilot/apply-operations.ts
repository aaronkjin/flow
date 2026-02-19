
import type {
  CopilotDraftWorkflow,
  CopilotDraftStep,
  CopilotDraftEdge,
  CopilotOperation,
  CopilotOperationAuditEntry,
  CopilotDiffSummary,
} from "./types";

export interface ApplyOperationsResult {
  nextDraft: CopilotDraftWorkflow;
  audit: CopilotOperationAuditEntry[];
  diffSummary: CopilotDiffSummary;
}

export function applyOperations(
  snapshot: CopilotDraftWorkflow,
  operations: CopilotOperation[]
): ApplyOperationsResult {
  let steps: CopilotDraftStep[] = JSON.parse(JSON.stringify(snapshot.steps));
  let edges: CopilotDraftEdge[] = JSON.parse(JSON.stringify(snapshot.edges));
  const audit: CopilotOperationAuditEntry[] = [];
  const diff: CopilotDiffSummary = {
    stepsAdded: 0,
    stepsRemoved: 0,
    stepsUpdated: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
  };

  for (const op of operations) {
    const result = applySingleOp(steps, edges, op);
    audit.push(result.entry);
    if (result.entry.status === "applied") {
      steps = result.steps;
      edges = result.edges;
      switch (op.op) {
        case "add_step":
          diff.stepsAdded++;
          break;
        case "remove_step":
          diff.stepsRemoved++;
          break;
        case "update_step_config":
        case "rename_step":
          diff.stepsUpdated++;
          break;
        case "add_edge":
          diff.edgesAdded++;
          break;
        case "remove_edge":
          diff.edgesRemoved++;
          break;
      }
    }
  }

  const nextDraft: CopilotDraftWorkflow = {
    title: snapshot.title,
    description: snapshot.description,
    assumptions: snapshot.assumptions,
    steps,
    edges,
  };

  return { nextDraft, audit, diffSummary: diff };
}


interface SingleOpResult {
  steps: CopilotDraftStep[];
  edges: CopilotDraftEdge[];
  entry: CopilotOperationAuditEntry;
}

function applySingleOp(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: CopilotOperation
): SingleOpResult {
  switch (op.op) {
    case "add_step":
      return applyAddStep(steps, edges, op);
    case "remove_step":
      return applyRemoveStep(steps, edges, op);
    case "update_step_config":
      return applyUpdateStepConfig(steps, edges, op);
    case "rename_step":
      return applyRenameStep(steps, edges, op);
    case "add_edge":
      return applyAddEdge(steps, edges, op);
    case "remove_edge":
      return applyRemoveEdge(steps, edges, op);
  }
}

function reject(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: CopilotOperation,
  reason: string
): SingleOpResult {
  return { steps, edges, entry: { op, status: "rejected", reason } };
}

function accept(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: CopilotOperation
): SingleOpResult {
  return { steps, edges, entry: { op, status: "applied" } };
}


function applyAddStep(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: Extract<CopilotOperation, { op: "add_step" }>
): SingleOpResult {
  const stepIds = new Set(steps.map((s) => s.id));

  if (stepIds.has(op.step.id)) {
    return reject(steps, edges, op, `Step ID '${op.step.id}' already exists`);
  }

  if (op.step.type === "trigger") {
    const existingTriggers = steps.filter((s) => s.type === "trigger");
    if (existingTriggers.length >= 1) {
      return reject(
        steps,
        edges,
        op,
        "Cannot add another trigger — workflow must have exactly one"
      );
    }
  }

  const newStep = { ...op.step, config: { ...op.step.config, type: op.step.type } };

  const newSteps = [...steps];
  if (op.afterStepId) {
    const afterIdx = newSteps.findIndex((s) => s.id === op.afterStepId);
    if (afterIdx !== -1) {
      newSteps.splice(afterIdx + 1, 0, newStep);
    } else {
      newSteps.push(newStep);
    }
  } else {
    newSteps.push(newStep);
  }

  return accept(newSteps, edges, op);
}


function applyRemoveStep(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: Extract<CopilotOperation, { op: "remove_step" }>
): SingleOpResult {
  const existing = steps.find((s) => s.id === op.stepId);
  if (!existing) {
    return reject(steps, edges, op, `Step '${op.stepId}' does not exist`);
  }

  if (existing.type === "trigger") {
    const triggerCount = steps.filter((s) => s.type === "trigger").length;
    if (triggerCount <= 1) {
      return reject(
        steps,
        edges,
        op,
        "Cannot remove the only trigger step"
      );
    }
  }

  if (steps.length <= 2) {
    return reject(
      steps,
      edges,
      op,
      "Cannot remove step — workflow must have at least 2 steps"
    );
  }

  const newSteps = steps.filter((s) => s.id !== op.stepId);
  const newEdges = edges.filter(
    (e) => e.source !== op.stepId && e.target !== op.stepId
  );

  for (const step of newSteps) {
    if (step.config.inputStepId === op.stepId) {
      step.config.inputStepId = "";
    }
    if (Array.isArray(step.config.showSteps)) {
      step.config.showSteps = (step.config.showSteps as string[]).filter(
        (id) => id !== op.stepId
      );
    }
    if (step.config.judgeStepId === op.stepId) {
      step.config.judgeStepId = "";
    }
    if (step.config.reviewTargetStepId === op.stepId) {
      step.config.reviewTargetStepId = "";
    }
  }

  return accept(newSteps, newEdges, op);
}


function applyUpdateStepConfig(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: Extract<CopilotOperation, { op: "update_step_config" }>
): SingleOpResult {
  const idx = steps.findIndex((s) => s.id === op.stepId);
  if (idx === -1) {
    return reject(steps, edges, op, `Step '${op.stepId}' does not exist`);
  }

  const patch = { ...op.configPatch };
  delete patch.type;

  const newSteps = [...steps];
  newSteps[idx] = {
    ...newSteps[idx],
    config: { ...newSteps[idx].config, ...patch },
  };

  return accept(newSteps, edges, op);
}


function applyRenameStep(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: Extract<CopilotOperation, { op: "rename_step" }>
): SingleOpResult {
  const idx = steps.findIndex((s) => s.id === op.stepId);
  if (idx === -1) {
    return reject(steps, edges, op, `Step '${op.stepId}' does not exist`);
  }

  const newSteps = [...steps];
  newSteps[idx] = { ...newSteps[idx], name: op.name };
  return accept(newSteps, edges, op);
}


function applyAddEdge(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: Extract<CopilotOperation, { op: "add_edge" }>
): SingleOpResult {
  const stepIds = new Set(steps.map((s) => s.id));

  if (!stepIds.has(op.source)) {
    return reject(
      steps,
      edges,
      op,
      `Edge source '${op.source}' does not reference an existing step`
    );
  }
  if (!stepIds.has(op.target)) {
    return reject(
      steps,
      edges,
      op,
      `Edge target '${op.target}' does not reference an existing step`
    );
  }

  const isDuplicate = edges.some(
    (e) =>
      e.source === op.source &&
      e.target === op.target &&
      (e.label ?? undefined) === (op.label ?? undefined)
  );
  if (isDuplicate) {
    return reject(steps, edges, op, "Duplicate edge already exists");
  }

  const testEdges = [
    ...edges,
    { source: op.source, target: op.target, label: op.label },
  ];
  if (wouldCreateCycle(steps, testEdges)) {
    return reject(steps, edges, op, "Adding this edge would create a cycle");
  }

  const newEdges = [
    ...edges,
    { source: op.source, target: op.target, label: op.label },
  ];
  return accept(steps, newEdges, op);
}


function applyRemoveEdge(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[],
  op: Extract<CopilotOperation, { op: "remove_edge" }>
): SingleOpResult {
  const idx = edges.findIndex(
    (e) => e.source === op.source && e.target === op.target
  );
  if (idx === -1) {
    return reject(
      steps,
      edges,
      op,
      `No edge from '${op.source}' to '${op.target}' found`
    );
  }

  const newEdges = edges.filter((_, i) => i !== idx);
  return accept(steps, newEdges, op);
}


function wouldCreateCycle(
  steps: CopilotDraftStep[],
  edges: CopilotDraftEdge[]
): boolean {
  const adj = new Map<string, string[]>();
  for (const step of steps) {
    adj.set(step.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const step of steps) {
    color.set(step.id, WHITE);
  }

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    for (const neighbor of adj.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) return true;
      if (color.get(neighbor) === WHITE && dfs(neighbor)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const step of steps) {
    if (color.get(step.id) === WHITE && dfs(step.id)) return true;
  }

  return false;
}
