import type { TokenUsageSummary } from "./token-tracking";

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: StepDefinition[];
  edges: EdgeDefinition[];
  canvasState?: CanvasState;
  createdAt: string;
  updatedAt: string;
  blockConfig?: WorkflowBlockConfig;
}

export interface StepDefinition {
  id: string;
  type: StepType;
  name: string;
  config: StepConfig;
  position?: { x: number; y: number };
}

export type StepType =
  | "trigger"
  | "llm"
  | "judge"
  | "hitl"
  | "connector"
  | "condition"
  | "agent"
  | "sub-workflow";

export type StepConfig =
  | TriggerStepConfig
  | LLMStepConfig
  | JudgeStepConfig
  | HITLStepConfig
  | ConnectorStepConfig
  | ConditionStepConfig
  | AgentStepConfig
  | SubWorkflowStepConfig;

export interface EdgeDefinition {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
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

export interface TriggerStepConfig {
  type: "trigger";
  triggerType: "dataset" | "manual" | "webhook";
  datasetId?: string;
  manualFields?: Array<{ name: string; type: "string" | "number" | "text" }>;
}

export interface LLMStepConfig {
  type: "llm";
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  responseFormat: "text" | "json";
}

export interface JudgeStepConfig {
  type: "judge";
  inputStepId: string;
  criteria: JudgeCriterion[];
  threshold: number;
  model: string;
}

export interface JudgeCriterion {
  name: string;
  description: string;
  weight: number;
}

export interface HITLStepConfig {
  type: "hitl";
  instructions: string;
  showSteps: string[];
  autoApproveOnJudgePass: boolean;
  judgeStepId?: string;
  reviewTargetStepId?: string;
}

export interface ConnectorStepConfig {
  type: "connector";
  connectorType: ConnectorType;
  action: string;
  params: Record<string, unknown>;
}

export type ConnectorType =
  | "slack"
  | "email"
  | "http"
  | "notion"
  | "google-sheets";

export interface ConditionStepConfig {
  type: "condition";
  expression: string;
  yesLabel?: string;
  noLabel?: string;
}

export interface AgentStepConfig {
  type: "agent";
  model: string;
  systemPrompt: string;
  taskPrompt: string;
  tools: AgentToolRef[];
  maxIterations: number;
  temperature: number;
  hitlOnLowConfidence: boolean;
  confidenceThreshold: number;
  outputSchema?: Record<string, unknown>;
}

export interface AgentToolRef {
  type: "connector" | "sub_workflow" | "custom_function";
  connectorType?: ConnectorType;
  action?: string;
  workflowId?: string;
  functionName?: string;
  functionDescription?: string;
  functionParameters?: Record<string, unknown>;
}

export interface AgentIteration {
  index: number;
  reasoning: string;
  toolCall?: { toolName: string; arguments: Record<string, unknown> };
  toolResult?: { success: boolean; output: Record<string, unknown>; error?: string };
  isComplete: boolean;
  confidence?: number;
  tokensUsed: { prompt: number; completion: number };
}

export interface SubWorkflowStepConfig {
  type: "sub-workflow";
  workflowId: string;
  inputMapping: Record<string, string>;
}

export interface WorkflowBlockConfig {
  blockName: string;
  blockDescription: string;
  blockIcon?: string;
  inputSchema: WorkflowBlockField[];
  outputStepId: string;
  outputFields?: string[];
}

export interface WorkflowBlockField {
  name: string;
  type: "string" | "number" | "text" | "boolean" | "json";
  description?: string;
  required: boolean;
  defaultValue?: unknown;
}

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
  stepStates: Record<string, StepState>;
  currentStepId: string | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  parentRunId?: string;
  parentStepId?: string;
  tokenUsage?: TokenUsageSummary;
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

export interface JudgeResult {
  criteriaScores: Record<string, number>;
  overallConfidence: number;
  issues: string[];
  recommendation: "pass" | "flag" | "fail";
  reasoning: string;
}

export interface HITLDecision {
  action: "approve" | "edit" | "reject";
  editedOutput?: Record<string, unknown>;
  comment?: string;
  targetStepId?: string;
}

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
  | "run_failed"
  | "agent_iteration"
  | "agent_tool_call"
  | "agent_complete"
  | "sub_workflow_started"
  | "sub_workflow_completed";

export interface TraceEvent {
  id: string;
  runId: string;
  stepId?: string;
  stepName?: string;
  type: TraceEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

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

export interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  source: string;
  fields: string[];
  itemCount: number;
}

export interface InterpolationContext {
  input: Record<string, unknown>;
  steps: Record<string, Record<string, unknown>>;
}

export interface ReviewItem {
  run: Run;
  workflowName: string;
  currentStep: StepDefinition;
  priorStepOutputs: Record<string, Record<string, unknown>>;
  judgeAssessment?: JudgeResult;
}
