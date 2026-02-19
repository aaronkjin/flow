
import type { StepType, StepConfig } from "@/lib/engine/types";

export interface CopilotDraftStep {
  id: string;
  type:
    | "trigger"
    | "llm"
    | "judge"
    | "hitl"
    | "connector"
    | "condition"
    | "agent"
    | "sub-workflow";
  name: string;
  config: Record<string, unknown>;
}

export interface CopilotDraftEdge {
  source: string;
  target: string;
  label?: string;
}

export interface CopilotDraftWorkflow {
  title: string;
  description?: string;
  assumptions?: string[];
  steps: CopilotDraftStep[];
  edges: CopilotDraftEdge[];
}

export interface CopilotValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface CopilotCompileResult {
  nodes: Array<{
    id: string;
    type: StepType;
    position: { x: number; y: number };
    data: {
      label: string;
      stepType: StepType;
      config: StepConfig;
      [key: string]: unknown;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    label?: string;
    type: string;
    animated: boolean;
  }>;
  workflowName: string;
  workflowDescription: string;
}

export interface CopilotGenerateRequest {
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  currentWorkflow?: {
    steps: CopilotDraftStep[];
    edges: CopilotDraftEdge[];
  } | null;
  artifactIds?: string[];
}

export interface CopilotGenerateResponse {
  draft: CopilotDraftWorkflow;
  validation: CopilotValidationResult;
  compiledPreview: CopilotCompileResult;
}


export type CopilotOperation =
  | { op: "add_step"; step: CopilotDraftStep; afterStepId?: string }
  | { op: "remove_step"; stepId: string }
  | { op: "update_step_config"; stepId: string; configPatch: Record<string, unknown> }
  | { op: "rename_step"; stepId: string; name: string }
  | { op: "add_edge"; source: string; target: string; label?: string }
  | { op: "remove_edge"; source: string; target: string };

export interface CopilotOperationAuditEntry {
  op: CopilotOperation;
  status: "applied" | "rejected";
  reason?: string;
}

export interface CopilotDiffSummary {
  stepsAdded: number;
  stepsRemoved: number;
  stepsUpdated: number;
  edgesAdded: number;
  edgesRemoved: number;
}

export interface CopilotRefineRequest {
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  currentWorkflow: {
    steps: CopilotDraftStep[];
    edges: CopilotDraftEdge[];
    workflowName?: string;
    workflowDescription?: string;
  };
}

export interface CopilotRefineResponse {
  operations: CopilotOperation[];
  audit: CopilotOperationAuditEntry[];
  nextDraft: CopilotDraftWorkflow;
  validation: CopilotValidationResult;
  compiledPreview: CopilotCompileResult;
  diffSummary: CopilotDiffSummary;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  draft?: CopilotDraftWorkflow;
  validation?: CopilotValidationResult;
  compiledPreview?: CopilotCompileResult;
  messageType?: "generate" | "refine";
  operations?: CopilotOperation[];
  audit?: CopilotOperationAuditEntry[];
  diffSummary?: CopilotDiffSummary;
  timestamp: string;
}
