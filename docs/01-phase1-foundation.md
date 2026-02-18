# Phase 1: Foundation (~3 hours)

## Goal

Set up the project scaffold, define all core TypeScript types, build the JSON persistence layer, the interpolation engine, and the core execution engine.

## Tasks

### 1.1 Scaffold Next.js + Dependencies (30 min)

**Files**: `package.json`, `tailwind.config.ts`, `src/app/layout.tsx`

- Create Next.js app with TypeScript, Tailwind, App Router
- Install and configure shadcn/ui (New York style, neutral theme)
- Install `@xyflow/react` for the visual workflow editor
- Install `@dagrejs/dagre` for auto-layout
- Install `openai` SDK
- Install `uuid` for ID generation
- Create project directory structure:
  ```
  src/lib/engine/
  src/lib/steps/
  src/lib/connectors/
  src/lib/persistence/
  src/lib/datasets/
  src/components/layout/
  src/components/workflow-editor/
  src/components/run/
  src/components/review/
  src/components/trace/
  data/workflows/
  data/runs/
  data/traces/
  data/datasets/
  ```
- Add `data/` to `.gitignore`

### 1.2 Core Types (45 min)

**File**: `src/lib/engine/types.ts`

All TypeScript type definitions in one central file:

- `WorkflowDefinition` — id, name, description, steps[], edges[]
- `StepDefinition` — id, type (trigger/llm/judge/hitl/connector/condition), config
- `EdgeDefinition` — source step, target step, label (for condition branches)
- `StepConfig` variants — `LLMStepConfig`, `JudgeStepConfig`, `HITLStepConfig`, `ConnectorStepConfig`, `ConditionStepConfig`, `TriggerStepConfig`
  - For HITL steps include optional `judgeStepId` (which judge unlocks auto-approve) and `reviewTargetStepId` (which upstream step should be overwritten when the reviewer edits output).
- `Run` — id, workflowId, status (pending/running/waiting_for_review/completed/failed), input, stepStates{}, currentStepId, timestamps
- `StepState` — status, input, output, error, startedAt, completedAt
- `JudgeResult` — criteria scores, overall confidence, flagged issues, recommendation
- `HITLDecision` — action (approve/edit/reject), editedOutput?, comment?, `targetStepId?` (explicit step whose output should be replaced when editing)
- `TraceEvent` — runId, stepId, type, data, timestamp
- `ConnectorResult` — success, data, error
- `DatasetConfig` — id, name, source, items[]

### 1.3 JSON Persistence Layer (30 min)

**File**: `src/lib/persistence/store.ts`

Pattern from reference `api/main.py` `_save/_load`:

- Generic `JsonStore<T>` class
- `constructor(directory: string)` — ensures directory exists
- `getAll(): T[]` — load all JSON files from directory
- `get(id: string): T | null` — load single by ID
- `save(id: string, data: T): void` — write JSON file atomically
- `delete(id: string): void` — remove JSON file
- In-memory cache for fast reads, write-through to disk
- Startup: load all existing files into cache
- Helper: `appendToJsonArray(filepath, item)` for trace events

### 1.4 Interpolation Engine (30 min)

**File**: `src/lib/engine/interpolation.ts`

Resolves `{{variable}}` templates in step configs:

- `interpolate(template: string, context: InterpolationContext): string`
- Context shape: `{ input: Record<string, any>, steps: Record<string, any> }`
- Supports: `{{input.fieldName}}`, `{{steps.stepId.fieldName}}`
- Nested access: `{{steps.classify.category}}` → looks up `context.steps.classify.category`
- Deep object interpolation: recurse through objects and arrays, interpolating all string values
- `interpolateObject(obj: any, context): any` — deep recursive interpolation

### 1.5 Execution Engine (45 min)

**File**: `src/lib/engine/engine.ts`

Core execution adapted from reference pipeline pattern:

```typescript
// Start a new run
startRun(workflowId: string, input: Record<string, any>): Promise<Run>
  → Load workflow from store
  → Create Run record (status: pending)
  → Save to store
  → Fire-and-forget: executeRunAsync()
  → Return Run immediately

// Internal async execution
executeRunAsync(workflow: WorkflowDefinition, run: Run): Promise<void>
  → Set status: running, save
  → Topologically sort steps based on edges
  → For each step:
      1. Build InterpolationContext from completed steps
      2. Interpolate step config
      3. Dispatch to step executor based on type
      4. On HITL pause: set status waiting_for_review, save, STOP
      5. On success: save step output, emit trace event, continue
      6. On error: save error, emit trace, mark run failed, STOP
  → All done: set status completed, save

// Resume after HITL
resumeRun(runId: string, decision: HITLDecision): Promise<Run>
  → Load run
  → Apply decision to current HITL step
  → If rejected: mark failed
  → If approved/edited: continue executeRunAsync from next step
  → Return updated Run

// Startup reconciliation
reconcileStaleRuns(): void
  → Scan all runs
  → Any with status "running" → mark as "failed" (stale)
```

Topological sort uses the workflow's edges to determine execution order.

## Verification

- [ ] `npm run dev` starts without errors
- [ ] All type definitions compile cleanly
- [ ] `JsonStore` can save/load/list/delete JSON files in `data/` directories
- [ ] `interpolate("Hello {{input.name}}", { input: { name: "World" } })` returns `"Hello World"`
- [ ] `interpolate("{{steps.step1.result}}", { steps: { step1: { result: "done" } } })` returns `"done"`
- [ ] Engine creates a Run record with `pending` status
- [ ] Topological sort correctly orders steps based on edge connections
