// ============================================================
// Action — Central Type Definitions
// ============================================================

// --- Workflow Definition (persisted) ---

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: StepDefinition[];
  edges: EdgeDefinition[];
  canvasState?: CanvasState; // React Flow positions for reopening editor
  createdAt: string;
  updatedAt: string;
}

export interface StepDefinition {
  id: string;
  type: StepType;
  name: string;
  config: StepConfig;
  position?: { x: number; y: number }; // Canvas position
}

export type StepType =
  | "trigger"
  | "llm"
  | "judge"
  | "hitl"
  | "connector"
  | "condition";

export type StepConfig =
  | TriggerStepConfig
  | LLMStepConfig
  | JudgeStepConfig
  | HITLStepConfig
  | ConnectorStepConfig
  | ConditionStepConfig;

export interface EdgeDefinition {
  id: string;
  source: string; // step ID
  target: string; // step ID
  sourceHandle?: string; // e.g. "pass", "flag", "yes", "no", "approve", "reject"
  targetHandle?: string;
  label?: string;
}

export interface CanvasState {
  viewport: { x: number; y: number; zoom: number };
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
}

// --- Step Configs ---

export interface TriggerStepConfig {
  type: "trigger";
  triggerType: "dataset" | "manual" | "webhook";
  datasetId?: string;
  manualFields?: Array<{ name: string; type: "string" | "number" | "text" }>;
}

export interface LLMStepConfig {
  type: "llm";
  model: string; // e.g. "gpt-4o-mini"
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  responseFormat: "text" | "json";
}

export interface JudgeStepConfig {
  type: "judge";
  inputStepId: string; // which step's output to judge
  criteria: JudgeCriterion[];
  threshold: number; // 0-1, auto-pass confidence level
  model: string;
}

export interface JudgeCriterion {
  name: string;
  description: string;
  weight: number; // 0-1
}

export interface HITLStepConfig {
  type: "hitl";
  instructions: string;
  showSteps: string[]; // step IDs whose outputs to show reviewer
  autoApproveOnJudgePass: boolean;
  judgeStepId?: string; // judge step that unlocks auto-approve
  reviewTargetStepId?: string; // step whose output should be edited by reviewer
}

export interface ConnectorStepConfig {
  type: "connector";
  connectorType: ConnectorType;
  action: string;
  params: Record<string, unknown>; // interpolation-ready
}

export type ConnectorType =
  | "slack"
  | "email"
  | "http"
  | "notion"
  | "google-sheets";

export interface ConditionStepConfig {
  type: "condition";
  expression: string; // e.g. "{{steps.judge.recommendation}} === 'pass'"
  yesLabel?: string;
  noLabel?: string;
}

// --- Run State (persisted) ---

export type RunStatus =
  | "pending"
  | "running"
  | "waiting_for_review"
  | "completed"
  | "failed";

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  input: Record<string, unknown>;
  stepStates: Record<string, StepState>; // keyed by step ID
  currentStepId: string | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting_for_review";

export interface StepState {
  stepId: string;
  status: StepStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// --- Judge Result ---

export interface JudgeResult {
  criteriaScores: Record<string, number>; // criterion name → score 0-1
  overallConfidence: number; // 0-1
  issues: string[];
  recommendation: "pass" | "flag" | "fail";
  reasoning: string;
}

// --- HITL Decision ---

export interface HITLDecision {
  action: "approve" | "edit" | "reject";
  editedOutput?: Record<string, unknown>;
  comment?: string;
  targetStepId?: string; // optional explicit step to overwrite when edited
}

// --- Trace ---

export type TraceEventType =
  | "run_started"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "llm_call"
  | "judge_result"
  | "hitl_paused"
  | "hitl_resumed"
  | "connector_fired"
  | "run_completed"
  | "run_failed";

export interface TraceEvent {
  id: string;
  runId: string;
  stepId?: string;
  stepName?: string;
  type: TraceEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

// --- Connector ---

export interface ConnectorResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface Connector {
  type: string;
  execute(
    action: string,
    params: Record<string, unknown>
  ): Promise<ConnectorResult>;
}

// --- Dataset ---

export interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  source: string;
  fields: string[];
  itemCount: number;
}

// --- Interpolation ---

export interface InterpolationContext {
  input: Record<string, unknown>;
  steps: Record<string, Record<string, unknown>>;
}

// --- Review (enriched view for frontend) ---

export interface ReviewItem {
  run: Run;
  workflowName: string;
  currentStep: StepDefinition;
  priorStepOutputs: Record<string, Record<string, unknown>>;
  judgeAssessment?: JudgeResult;
}
