# Phase 2: Step Executors (~2 hours)

## Goal

Build the four step executor modules that the engine dispatches to: LLM, Judge, HITL, and Connector.

## Tasks

### 2.1 LLM Step Executor (30 min)

**File**: `src/lib/steps/llm.ts`

OpenAI integration for the worker LLM:

- `executeLLMStep(config: LLMStepConfig, context: InterpolationContext): Promise<StepOutput>`
- Interpolates the prompt template with context
- Calls OpenAI Chat Completions API (gpt-4o-mini default, configurable)
- Config fields:
  - `model`: string (default "gpt-4o-mini")
  - `systemPrompt`: string template
  - `userPrompt`: string template
  - `temperature`: number (default 0.7)
  - `responseFormat`: "text" | "json" (for structured output)
- Returns: `{ result: string, usage: { promptTokens, completionTokens }, model }`
- Error handling: catches OpenAI errors, returns structured error

### 2.2 Judge Step Executor (45 min)

**File**: `src/lib/steps/judge.ts`

LLM-as-judge quality gate:

- `executeJudgeStep(config: JudgeStepConfig, context: InterpolationContext): Promise<JudgeResult>`
- Takes the output from a prior step (via interpolation) and evaluates it
- Config fields:
  - `inputStepId`: which step's output to judge
  - `criteria`: Array of `{ name: string, description: string, weight: number }`
  - `threshold`: number (0-1) — auto-pass confidence level
  - `model`: string (default "gpt-4o-mini")
- Constructs a structured judge prompt:
  - System: "You are a quality assessment judge..."
  - Includes the criteria definitions
  - Asks for JSON output with per-criterion scores (0-1), overall confidence, issues[], recommendation
- Parses JSON response into `JudgeResult`:
  ```typescript
  {
    criteriaScores: { [criterionName]: number },
    overallConfidence: number,
    issues: string[],
    recommendation: "pass" | "flag" | "fail",
    reasoning: string
  }
  ```
- If `overallConfidence >= threshold`: recommendation = "pass"
- If below threshold: recommendation = "flag" (routes to HITL)

### 2.3 HITL Step Executor (20 min)

**File**: `src/lib/steps/hitl.ts`

Human-in-the-loop pause/resume signal:

- `executeHITLStep(config: HITLStepConfig, run: Run): Promise<{ paused: true }>`
- This step doesn't "execute" — it signals the engine to pause
- Config fields:
  - `instructions`: string — what the reviewer should check
  - `showSteps`: string[] — which prior step outputs to show reviewer
  - `autoApproveOnJudgePass`: boolean — skip HITL if judge passed above threshold
- Returns `{ paused: true }` signal to engine
- Engine sets run status to `waiting_for_review` and stops execution
- Resume flow (handled by engine):
  - `HITLDecision` comes in via API
  - `action: "approve"` → step marked complete, execution continues
  - `action: "edit"` → step output replaced with edited version, continues
  - `action: "reject"` → run marked failed with rejection reason

### 2.4 Connector Dispatch Step (25 min)

**File**: `src/lib/steps/connector.ts`

Routes to the appropriate connector from the registry:

- `executeConnectorStep(config: ConnectorStepConfig, context: InterpolationContext): Promise<ConnectorResult>`
- Config fields:
  - `connectorType`: string (slack/email/http/notion/google-sheets)
  - `action`: string (e.g., "send_message", "send_email", "append_row")
  - `params`: Record<string, any> — connector-specific params (interpolated)
- Flow:
  1. Look up connector in registry by `connectorType`
  2. Interpolate all param values with context
  3. Call `connector.execute(action, params)`
  4. Return `ConnectorResult`
- Error handling: connector not found, execution errors

## Verification

- [ ] LLM step calls OpenAI and returns structured output (requires OPENAI_API_KEY)
- [ ] Judge step evaluates sample text against criteria and returns scores
- [ ] Judge correctly flags low-confidence outputs (below threshold)
- [ ] HITL step returns pause signal to engine
- [ ] Connector dispatch routes to correct connector (tested with mock)
- [ ] All steps handle errors gracefully without crashing the engine
