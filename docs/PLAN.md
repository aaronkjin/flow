# Action — Knowledge Work Automation Platform

## Context

Build a skateboard version of an agent builder + execution engine that automates real-world knowledge work. Users visually compose workflows by dragging and connecting blocks on a canvas (like Sola). The platform translates that visual graph into a JSON workflow definition internally, then executes it through a generalizable engine with LLM steps, LLM-as-judge quality gates, HITL review, and real-world connectors.

Timeline: ~12-18 hours over 2 days  
Stack: Next.js App Router + React + TypeScript + shadcn/ui + React Flow + OpenAI API  
Priority: Core engine > Visual builder UX > HITL ergonomics > Tracing

---

## User Flow

User drags blocks onto canvas → connects them with edges  
 ↓  
Canvas auto-generates WorkflowDefinition (JSON) internally  
 ↓  
User clicks "Run" → selects input (single item or dataset batch)  
 ↓  
Execution engine runs steps sequentially, pausing at HITL gates  
 ↓  
Reviewer sees LLM output + Judge assessment → approves/edits/rejects  
 ↓  
Connectors fire real actions (Slack message, email, Sheets row, etc.)  
 ↓  
Full trace recorded for every step (viewable in trace viewer)

Users NEVER see raw JSON/YAML — the visual editor is the only authoring interface.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    Web UI (Next.js)                     │
│                                                          │
│  ┌─────────────────┐ ┌──────────┐ ┌───────────────────┐ │
│  │  Visual Workflow│ │   Run    │ │   HITL Review     │ │
│  │  Editor (React  │ │Dashboard │ │   Panel           │ │
│  │  Flow canvas)   │ │          │ │                   │ │
│  └─────────────────┘ └──────────┘ └───────────────────┘ │
│  ┌─────────────────┐                                     │
│  │  Trace Viewer   │                                     │
│  └─────────────────┘                                     │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────┐
│                    Next.js API Routes                    │
│  /api/workflows  /api/runs  /api/review  /api/datasets  │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────┐
│                    Core Engine (lib/)                    │
│                                                          │
│  Execution Engine │ Step Executors │ Real Connectors     │
│  Interpolation    │ JSON Persist.  │ Trace Store         │
│                                                          │
│  Patterns adapted from reference:                │
│  • JSON file persistence (api/main.py _save/_load)      │
│  • Async exec + status tracking (api/main.py)           │
│  • Pipeline lifecycle w/ per-step error handling        │
│  • Startup reconciliation for stale runs                │
│  • Result models & data contracts                       │
└──────────────────────────────────────────────────────────┘
```

---

## Project Structure

```text
action/
  src/
    app/
      layout.tsx                         # Root layout + sidebar nav
      page.tsx                           # Dashboard (stats + recent runs)
      workflows/
        page.tsx                         # Workflow list
        new/page.tsx                     # Visual workflow editor (create)
        [workflowId]/page.tsx            # Visual workflow editor (edit)
      runs/
        page.tsx                         # All runs dashboard
        [runId]/page.tsx                 # Run detail + trace viewer
      review/
        page.tsx                         # HITL review queue
        [runId]/page.tsx                 # Review panel (output + judge + actions)
      api/
        workflows/route.ts               # GET list, POST create
        workflows/[workflowId]/route.ts  # GET, PUT, DELETE
        runs/route.ts                    # GET list, POST start
        runs/[runId]/route.ts            # GET status/detail
        runs/[runId]/resume/route.ts     # POST resume after HITL
        runs/[runId]/trace/route.ts      # GET trace events
        review/route.ts                  # GET pending reviews
        review/[runId]/route.ts          # POST HITL decision
        datasets/route.ts                # GET available datasets
        datasets/[datasetId]/route.ts    # GET dataset items

    lib/
      engine/
        types.ts              # All TypeScript type definitions (central)
        engine.ts             # Core execution: startRun, executeRunAsync, resumeRun
        interpolation.ts      # {{step.field}} template resolution
      steps/
        llm.ts                # LLM call step (OpenAI)
        judge.ts              # LLM-as-judge quality gate
        hitl.ts               # HITL pause/resume
        connector.ts          # Connector dispatch (routes to specific connector)
      connectors/
        registry.ts           # Connector interface + registry
        slack.ts              # Slack Incoming Webhook (REAL)
        email.ts              # Resend email (REAL)
        http.ts               # Generic HTTP/Webhook (REAL)
        notion.ts             # Notion database entry (REAL)
        google-sheets.ts      # Google Sheets append row (REAL)
      persistence/
        store.ts              # JSON file CRUD
      datasets/
        loader.ts             # Dataset loading + demo configs

    components/
      layout/
        sidebar.tsx           # Nav with review badge count
        header.tsx            # Breadcrumbs
      workflow-editor/
        workflow-canvas.tsx   # React Flow canvas (main editor)
        block-palette.tsx     # Left sidebar: draggable block types
        config-panel.tsx      # Right panel: selected node config
        toolbar.tsx           # Top bar: save, run, undo
        nodes/                # Custom React Flow node components
          trigger-node.tsx    # Dataset/webhook/manual trigger
          llm-node.tsx        # LLM action block
          judge-node.tsx      # LLM-as-judge block
          hitl-node.tsx       # Human review gate block
          connector-node.tsx  # Connector block (Slack/Email/Sheets/etc.)
          condition-node.tsx  # Conditional branch block
        edges/
          workflow-edge.tsx   # Custom styled edges
        hooks/
          use-workflow.ts     # State management for canvas
          use-drag-drop.ts    # DnD from palette to canvas
      run/
        run-list-table.tsx
        run-progress.tsx
        run-status-badge.tsx
      review/
        review-panel.tsx      # Full HITL review interface
        judge-assessment.tsx  # Confidence bar + criteria scores + issues
        output-editor.tsx     # Editable output for "edit" action
      trace/
        trace-timeline.tsx    # Vertical timeline of events
        trace-event-detail.tsx

  data/                       # JSON file persistence (gitignored)
    workflows/                # {id}.json — workflow definitions
    runs/                     # {id}.json — run state
    traces/                   # {runId}-trace.json — trace events
    datasets/                 # Pre-downloaded dataset samples
```

---

## Visual Workflow Editor (React Flow)

### Block Types (draggable from palette)

| Block       | Icon      | Color  | Handles                      | Purpose                                      |
| ----------- | --------- | ------ | ---------------------------- | -------------------------------------------- |
| Trigger     | Play      | Dark   | 1 output                     | Entry point: dataset replay, manual, webhook |
| LLM Action  | Sparkles  | Blue   | 1 in, 1 out                  | Call OpenAI with templated prompt            |
| Judge       | Scale     | Amber  | 1 in, 2 out (pass/flag)      | LLM evaluates prior step's output            |
| HITL Review | User      | Green  | 1 in, 2 out (approve/reject) | Pause for human decision                     |
| Connector   | Plug      | Purple | 1 in, 1 out                  | Fire real action (Slack, Email, etc.)        |
| Condition   | GitBranch | Gray   | 1 in, 2 out (yes/no)         | Branch based on expression                   |

### UX Flow

1. Left sidebar: Block palette grouped by category (Triggers, AI, Review, Actions, Logic)
2. Canvas: Drag blocks, connect with edges, zoom/pan, minimap
3. Right panel: Click any block → config form appears (prompt editor for LLM, criteria for Judge, connector params, etc.)
4. Toolbar: Save, Run (opens input picker), workflow name/description
5. Auto-layout: Dagre for automatic top-to-bottom arrangement
6. Serialization: Canvas state (nodes + edges) → WorkflowDefinition JSON on save

### Canvas → JSON Translation

When user saves, we traverse the React Flow graph:

- Each node becomes a StepDefinition with its type and config
- Edge connections determine step ordering and dependsOn relationships
- Condition node edges (yes/no handles) become conditional step references
- The entire graph serializes to a WorkflowDefinition and persists via API

### Key Libraries

- `@xyflow/react` — node-based canvas (MIT, ~42kB gzipped)
- `@dagrejs/dagre` — auto-layout algorithm

---

## Real Connectors (not stubbed)

All use API keys or webhook URLs — zero OAuth complexity.

| Connector     | Auth                               | Time   | Implementation                                                    |
| ------------- | ---------------------------------- | ------ | ----------------------------------------------------------------- |
| Slack         | Webhook URL                        | 15 min | POST to webhook URL with JSON payload                             |
| HTTP/Webhook  | Configurable (Bearer/API key/none) | 20 min | Generic `fetch()` wrapper with configurable method, headers, body |
| Resend Email  | API key                            | 20 min | POST to Resend API with to/subject/html                           |
| Notion        | Internal Integration Token         | 30 min | Create page in Notion database via `@notionhq/client`             |
| Google Sheets | Service Account JSON               | 45 min | Append row via `googleapis` Sheets API                            |

Total connector time: ~2.5 hours

Each connector implements a shared interface:

```ts
interface Connector {
  type: string;
  execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<ConnectorResult>;
}
```

Config panel for connector blocks shows a dropdown to pick connector type, then type-specific fields (webhook URL for Slack, API key for Resend, spreadsheet ID for Sheets, etc.).

---

## Core Engine Design

### Execution Flow

```text
startRun(workflow, input)
  → Create Run record (status: pending) → save to JSON
  → Fire-and-forget async execution
  → Return Run immediately to API caller

executeRunAsync(workflow, run)
  → Set status: running → save
  → For each step in topological order:
      1. Check condition (interpolate + evaluate)
      2. Build context from completed steps' outputs
      3. Dispatch to step executor (llm/judge/hitl/connector)
      4. On HITL: set status waiting_for_review → save → STOP
      5. On success: save step output + emit trace → continue
      6. On error: save error + emit trace → mark run failed
  → All steps done: set status completed → save

resumeRun(runId, decision)
  → Load run from JSON
  → Apply HITL decision (approve/edit/reject)
  → If rejected: mark run failed
  → If approved/edited: continue from next step
```

### LLM-as-Judge Pattern

1. Worker LLM produces output (e.g., drafted email, extracted fields)
2. Judge LLM evaluates against configurable criteria (accuracy, completeness, tone, etc.)
3. Judge outputs: per-criterion scores, overall confidence (0-1), flagged issues, recommendation
4. If confidence >= threshold: workflow can auto-continue (skip HITL)
5. If confidence < threshold: routes to HITL, reviewer sees output + judge assessment side-by-side

### Variable Interpolation

- `{{input.fieldName}}` — workflow input data
- `{{steps.stepId.fieldName}}` — output from a completed step
- Resolved at each step before execution
- Used in: LLM prompts, connector params, conditions

### Persistence (JSON files — pattern from reference `api/main.py`)

- Workflows: `data/workflows/{id}.json`
- Runs: `data/runs/{id}.json` — saved after every step transition
- Traces: `data/traces/{runId}-trace.json` — appended after every event
- Startup reconciliation: on API boot, scan for runs stuck in running state, mark as failed

### Patterns Reused from Reference

Pattern: JSON file CRUD + in-memory cache  
Source: `api/main.py` `_load_submissions` / `_save_submission`  
Adaptation: TypeScript `store.ts` with same load-all-on-boot, save-on-change pattern

Pattern: Async background execution  
Source: `api/main.py` `ThreadPoolExecutor.submit()`  
Adaptation: Node.js async Promise (fire-and-forget from API handler)

Pattern: Status state machine  
Source: `api/main.py` `pending→running→completed/failed`  
Adaptation: Extended: `pending→running→waiting_for_review→completed/failed`

Pattern: Startup reconciliation  
Source: `api/main.py` `_reconcile_stale_submissions()`  
Adaptation: Same: scan runs dir, check for stale running records

Pattern: Pipeline with per-step error handling  
Source: `runner/run_task.py` `run_task()`  
Adaptation: Each step wrapped in try/catch, errors save to step state

Pattern: Structured result models  
Source: `runner/run_task.py` results dict  
Adaptation: TypeScript interfaces: `Run`, `StepState`, `JudgeResult`, etc.

Pattern: Batch parallel execution  
Source: `api/main.py` `/submit-parallel`  
Adaptation: Batch run endpoint for dataset replay

---

## Demo Workflows (proving generalizability)

### Demo 1: IT Support Ticket Triage + Response

Dataset: `Console-AI/IT-helpdesk-synthetic-tickets` (500 records, MIT)  
Blocks: Trigger → LLM (draft response) → Judge (evaluate quality) → HITL Review → Slack notification + Resend email

### Demo 2: Resume Screening

Dataset: `AzharAli05/Resume-Screening-Dataset` (10.2k records, MIT)  
Blocks: Trigger → LLM (extract qualifications + screen) → Judge (evaluate accuracy/fairness) → HITL Review → Google Sheets (log decision) + Notion (create candidate record)

Both run on the same engine — only the canvas configuration differs.

---

## Time Budget (12-18 hours)

### Phase 1: Foundation (3 hrs)

| Task                                                 | Time   | Files                                     |
| ---------------------------------------------------- | ------ | ----------------------------------------- |
| Scaffold Next.js + shadcn/ui + Tailwind + React Flow | 30 min | package.json, tailwind.config, layout.tsx |
| Core types (all interfaces)                          | 45 min | lib/engine/types.ts                       |
| JSON persistence layer                               | 30 min | lib/persistence/store.ts                  |
| Interpolation engine                                 | 30 min | lib/engine/interpolation.ts               |
| Execution engine (start, execute, resume)            | 45 min | lib/engine/engine.ts                      |

### Phase 2: Step Executors (2 hrs)

| Task                                  | Time   | Files                  |
| ------------------------------------- | ------ | ---------------------- |
| LLM step (OpenAI integration)         | 30 min | lib/steps/llm.ts       |
| Judge step (criteria scoring, issues) | 45 min | lib/steps/judge.ts     |
| HITL step (pause/resume signal)       | 20 min | lib/steps/hitl.ts      |
| Connector dispatch step               | 25 min | lib/steps/connector.ts |

### Phase 3: Real Connectors (2.5 hrs)

| Task                           | Time   | Files                           |
| ------------------------------ | ------ | ------------------------------- |
| Connector interface + registry | 15 min | lib/connectors/registry.ts      |
| Slack (webhook)                | 15 min | lib/connectors/slack.ts         |
| HTTP/Webhook (generic)         | 20 min | lib/connectors/http.ts          |
| Resend (email)                 | 20 min | lib/connectors/email.ts         |
| Notion (database entry)        | 30 min | lib/connectors/notion.ts        |
| Google Sheets (append row)     | 45 min | lib/connectors/google-sheets.ts |

### Phase 4: API Routes (1.5 hrs)

| Task                                             | Time   | Files                                  |
| ------------------------------------------------ | ------ | -------------------------------------- |
| Workflow CRUD                                    | 25 min | api/workflows/                         |
| Run execution (start, status, resume)            | 25 min | api/runs/                              |
| Review endpoints (pending list, submit decision) | 20 min | api/review/                            |
| Trace + dataset endpoints                        | 20 min | api/runs/[runId]/trace/, api/datasets/ |

### Phase 5: Visual Workflow Editor (3 hrs)

| Task                                    | Time   | Files                 |
| --------------------------------------- | ------ | --------------------- |
| React Flow canvas setup + basic layout  | 30 min | workflow-canvas.tsx   |
| Custom node components (6 types)        | 45 min | nodes/\*.tsx          |
| Block palette (draggable sidebar)       | 30 min | block-palette.tsx     |
| Config panel (per-block-type forms)     | 45 min | config-panel.tsx      |
| Canvas ↔ JSON serialization             | 20 min | hooks/use-workflow.ts |
| Toolbar (save, run, name) + auto-layout | 10 min | toolbar.tsx           |

### Phase 6: HITL + Dashboard + Trace (2.5 hrs)

| Task                                    | Time   | Files                                         |
| --------------------------------------- | ------ | --------------------------------------------- |
| Dashboard page (stats, recent runs)     | 25 min | app/page.tsx                                  |
| Run list + run detail page              | 25 min | app/runs/                                     |
| Trace timeline viewer                   | 30 min | trace/trace-timeline.tsx                      |
| Review queue page                       | 20 min | app/review/page.tsx                           |
| Review panel (output + judge + actions) | 40 min | review/review-panel.tsx, judge-assessment.tsx |
| Sidebar + layout + navigation           | 10 min | layout/                                       |

### Phase 7: Demo Integration (2 hrs)

| Task                                                                          | Time   |
| ----------------------------------------------------------------------------- | ------ |
| Dataset loader + download samples                                             | 30 min |
| Ticket triage workflow (build on canvas + test E2E)                           | 30 min |
| Resume screening workflow (build on canvas + test E2E)                        | 30 min |
| Integration testing (full loop: build → run → trace → HITL → connectors fire) | 30 min |

### Phase 8: Polish + README (1 hr)

| Task                                           | Time   |
| ---------------------------------------------- | ------ |
| Error handling + edge cases                    | 20 min |
| README (setup, architecture, demo walkthrough) | 25 min |
| Final cleanup                                  | 15 min |

Total: ~17.5 hours (fits within 12-18hr budget)

---

## Key Design Decisions

Decision: React Flow for visual editor  
Rationale: Industry standard for node-based UIs in React. MIT license, ~42kB, first-class TypeScript + SSR support. Nodes are plain React components → shadcn/ui works inside them.

Decision: Canvas auto-generates JSON  
Rationale: Users never write YAML/JSON. Visual graph is the source of truth. On save, we serialize nodes+edges → WorkflowDefinition. Engine consumes the same JSON either way.

Decision: Real connectors, not stubs  
Rationale: All 5 use API keys or webhooks (zero OAuth). Total ~2.5hrs. Makes the demo compelling — real Slack messages, real emails, real Sheets rows.

Decision: JSON files for persistence  
Rationale: Proven by reference. Zero setup, inspectable, fast for demo scale.

Decision: Next.js API routes as backend  
Rationale: Single deployment. Engine runs as async Promise in same Node.js process. Fine for demo scale.

Decision: Polling for status updates  
Rationale: Frontend polls `/api/runs/{id}` every 2s. Simpler than WebSockets. Adequate for 1-3 concurrent runs.

---

## Verification Plan

1. Engine unit test: Create a 2-step workflow programmatically (LLM → connector), run it, verify trace JSON contains all expected events
2. Visual editor: Open `/workflows/new`, drag 4 blocks, connect them, save, verify `data/workflows/{id}.json` matches canvas
3. HITL flow: Run a workflow with a Judge+HITL step, verify run pauses at `waiting_for_review`, submit approve via `/review/{runId}`, verify run completes
4. Real connectors: Run ticket triage workflow → verify real Slack message arrives + real email sent via Resend
5. Generalizability: Create a third workflow from scratch via the visual editor (different block arrangement) and run it successfully
6. Trace viewer: Open a completed run, verify trace timeline shows every step with inputs/outputs/timing
