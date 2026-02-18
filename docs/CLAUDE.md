# Action — Master Briefing (CLAUDE.md)

## Mission Snapshot

- Build a "skateboard" (minimal but end-to-end) knowledge-work automation platform.
- Users design workflows visually, we translate to JSON definitions, then the execution engine runs steps with LLMs, judges, HITL, and real connectors.

## Current Status

- **Phase 1 (Foundation): COMPLETE** — scaffold, types, persistence, interpolation, and execution engine.
- **Phase 2 (Step Executors): COMPLETE** — LLM, Judge, HITL, and Connector dispatch all implemented. Connector registry ready for Phase 3 connectors.
- **Phase 3 (Real Connectors): COMPLETE** — all 5 connectors implemented (Slack, HTTP, Email, Notion, Google Sheets). Barrel file `src/lib/connectors/index.ts` triggers registration on import.
- **Phase 4 (API Routes): COMPLETE** — all 10 route files implemented: workflow CRUD, run start/status/resume, review queue/decision, trace, datasets. Dataset loader extracted to `src/lib/datasets/loader.ts`.
- **Phase 5 (Visual Workflow Editor): COMPLETE** — React Flow canvas, 6 custom node types, block palette with drag-and-drop, config panel for all step types, toolbar (save/run/layout), serialization hook, and 3 app pages (list, new, edit).
- **Phase 6 (Dashboard + HITL UI + Trace): COMPLETE** — root layout with sidebar, dashboard with stats/recent runs, run list/detail with polling, trace timeline viewer, review queue with auto-refresh, full review panel with judge assessment/output editor/approve-edit-reject actions, mobile responsive.
- **Phase 7 (Demo Integration): COMPLETE** — demo datasets (IT tickets + resumes) and sample workflow definitions seeded via `npm run seed`.
- **Phase 7.1 (Design Overhaul): COMPLETE** — Apple-level aesthetic: Libre Baskerville headings with italic-on-hover, Inter body, unified page layouts (Header with actions/badge slots), dashboard stat card redesign (sub-metrics, no icons), dropdown menu for workflow actions, workflow description input, removed redundant Runs Actions column, toolbar premium polish (inline inputs, ghost buttons), orange accent system (Run, New Workflow, Start Run buttons + hover arrows), config panel refinements (bg tint, Baskerville labels, tinted form fields), React Flow canvas polish (hidden watermark, styled controls), branded empty states with italic Baskerville "*Action*", muted status badge colors, refined node borders, generous whitespace throughout.
- **Phase 7.2 (Keyboard Navigation): NEXT** — add keyboard Up/Down/Enter navigation to all list pages (Workflows, Runs, Reviews, Dashboard), block palette, and Left/Right editor zone switching. Shared `useKeyboardNav` hook.

## Guardrails

1. Skateboard mindset: always prioritize the smallest loop that proves the riskiest assumption.
2. **Docs first**: All planning artifacts live under `docs/`. We already have per-phase guides (`00-` through `08-`), `PLAN.md`, and this file. **Never delete them.**
3. `CLAUDE.md` + `SPEC.md` are the canonical onboarding docs for any coding subagent. Keep them updated as the source of truth.
4. No destructive commands (e.g., `git reset --hard`, removing other agents' work) unless explicitly requested.
5. Work in TypeScript/Next.js idioms; prefer functional React components and server actions where needed.

## Repository Layout

```
action/
  docs/                # Planning + delegation hub (read README here first)
  src/
    app/               # Next.js App Router routes (API + UI)
    components/        # UI composables (layout, workflow editor, run, review, trace)
    lib/
      connectors/      # Slack, Email, HTTP, Notion, Google Sheets integrations
      datasets/        # Dataset loader utilities
      engine/          # Types, interpolation, execution engine core
      persistence/     # JsonStore + trace helpers (see store.ts)
      steps/           # Step executors (llm, judge, hitl, connector)
      utils.ts         # UI utility helpers
  public/              # Static assets
  data/                # Runtime JSON stores (gitignored)
  package.json         # Scripts + deps
```

## Data & Persistence Contract

- All persisted artifacts are JSON files under `data/` (ignored by git). `src/lib/persistence/store.ts` already implements a cached `JsonStore` plus helper functions.
- **Directories**:
  - `data/workflows/{workflowId}.json` — serialized `WorkflowDefinition` including `steps`, `edges`, `canvasState`, metadata.
  - `data/runs/{runId}.json` — `Run` state with `status`, `currentStepId`, `stepStates` keyed by step ID, timestamps.
  - `data/traces/{runId}-trace.json` — JSON array of `TraceEvent` entries `{ runId, stepId, type, data, timestamp }` appended via `appendToJsonArray`.
  - `data/datasets/*.json` — cached dataset blobs used by triggers (Phase 7).
- **Run lifecycle contract**:
  1. `pending` → run persisted after POST `/api/runs`.
  2. `running` → engine processing steps sequentially (topological order from workflow edges).
  3. `waiting_for_review` → engine paused on HITL; resume via `/api/runs/:id/resume`/`/api/review/:runId`.
  4. Terminal states: `completed` or `failed`.
- **Interpolation context**: `context.input` carries workflow input payload; `context.steps[stepId]` stores each step's output for `{{steps.someStep.field}}` templates. Deep interpolation is required for nested config objects/arrays.

## External Integrations & Env Vars

```
Required now: OPENAI_API_KEY (LLM + judge)
Optional connectors (Phase 3+): SLACK_WEBHOOK_URL, RESEND_API_KEY, NOTION_API_KEY,
  GOOGLE_SERVICE_ACCOUNT_JSON, plus per-step secrets (webhooks, dataset IDs, etc.).
```

- Use simple `fetch` for Slack, HTTP, Resend. Use official SDKs for Notion + Google.
- Protect secrets by reading from `process.env` on server only; never leak to the browser.

## Technical Notes

- Next.js 16.1.6 + App Router + React 19.2. Use server components by default; client components explicitly marked (`"use client"`).
- Styling: Tailwind v4 + shadcn/ui (default theme). `src/app/globals.css` already exists; keep tokens consistent.
- React Flow (`@xyflow/react` v12) powers the visual editor; `@dagrejs/dagre` v2 handles auto-layout.
- The engine's JSON persistence + async execution patterns are adapted from the reference project pattern (JSON file CRUD, fire-and-forget execution, startup reconciliation).
- Keep connectors optional: degrade gracefully when env vars missing (surface actionable errors in traces/UI).
- HITL flow is first-class: run must pause cleanly, review queue surfaces context, resume updates run state.

## Testing & Dev Commands

- `npm install` — install deps
- `npm run dev` — launch Next.js dev server (port 3000)
- `npm run lint` — ESLint (Next.js preset)
- Future: add targeted tests (e.g., engine unit tests) under `src/lib/**/__tests__` if time allows.
- Manual verification checklists for each phase live in `docs/0*-phase*.md`.

## Reading Order for New Subagents

Read these **before writing any code**, in this order:

1. **`docs/CLAUDE.md`** (this file) — Start here. Project briefing, repo layout, data contracts, env vars, what's already built, guardrails. Enough context on its own to avoid breaking things.
2. **`docs/SPEC.md`** — Find your assigned task. `[DONE]` markers show what exists; task descriptions list files to touch and dependencies. This is your work order.
3. **Your phase doc** (e.g., `docs/02-phase2-step-executors.md`) — Detailed implementation guidance for your specific assignment: function signatures, expected behavior, validation checklist.

**Reference only** (consult when you need broader context, not required up front):

4. `docs/PLAN.md` — Full architecture, design decisions, time budget. Useful if you need to understand _why_ something is designed a certain way or how your piece fits into the whole.
5. `docs/INSTRUCTIONS.md` — Original work-trial brief + skateboard mindset definition. Useful for scope judgment calls ("should I build this extra thing?" — probably not).
6. `docs/README.md` — Index of all docs. Useful if you need to find a doc you weren't pointed to.

## Phase 1 Implementation Notes

- `src/lib/engine/types.ts` — all core types (WorkflowDefinition, Run, StepState, JudgeResult, HITLDecision, TraceEvent, ConnectorResult, InterpolationContext, etc.). HITLStepConfig includes `judgeStepId?` and `reviewTargetStepId?`. HITLDecision includes `targetStepId?`.
- `src/lib/persistence/store.ts` — generic `JsonStore<T>` with in-memory cache + write-through, `appendToJsonArray`, `readJsonArray`, singleton getters (direct type imports, no dynamic require)
- `src/lib/engine/interpolation.ts` — `interpolate()`, `interpolateObject()`, `evaluateCondition()`
- `src/lib/engine/engine.ts` — `startRun()`, `resumeRun()`, `reconcileStaleRuns()`, topological sort (Kahn's with cycle detection), HITL pause/resume, `shouldSkipStep`/`isEdgeSatisfied` for condition/judge/HITL branch routing, trace emission. Auto-approve logic for HITL uses `config.judgeStepId` or falls back to searching `showSteps` for a judge step.

## Phase 2 Implementation Notes

- `src/lib/steps/llm.ts` — `executeLLMStep()`: OpenAI chat completions, reads `OPENAI_API_KEY` at call time, 30s timeout, JSON mode support with `response_format: { type: "json_object" }`, returns `{ result, model, usage: { promptTokens, completionTokens, totalTokens } }`
- `src/lib/steps/judge.ts` — `executeJudgeStep()`: LLM-as-judge via OpenAI, structured JSON prompt, low temperature (0.3), threshold-based recommendation override (pass/flag/fail), graceful parse failure fallback, returns `JudgeResult`-conformant shape
- `src/lib/steps/hitl.ts` — `executeHITLStep()`: returns `{ paused: true }` (all real logic in engine.ts)
- `src/lib/steps/connector.ts` — `executeConnectorStep()`: dispatches to connector registry, error handling wraps both thrown errors and `{ success: false }` returns
- `src/lib/connectors/registry.ts` — `registerConnector()`, `getConnector()`, `getRegisteredTypes()` backed by module-level `Map<string, Connector>`

The only barrel `index.ts` is `src/lib/connectors/index.ts` (side-effect imports for connector registration). All other modules import directly from their source files. Document any new decisions back in this file to keep every subagent aligned.

## Phase 5 Implementation Notes

- **Hooks** — `src/components/workflow-editor/hooks/use-workflow.ts` (525 lines): central state hook exporting `WorkflowNodeData` interface and `UseWorkflowReturn` interface. Manages React Flow nodes/edges, selection, node CRUD (addNode with label + configOverrides), serialization (nodes/edges → StepDefinition[]/EdgeDefinition[]), API persistence (POST create / PUT update), run execution (auto-save before run), dagre auto-layout, dirty/saving/loading flags. `addNode` signature: `(type: StepType, position: { x: number; y: number }, options?: { label?: string; configOverrides?: Partial<StepConfig> }) => void`.
- **DnD hook** — `src/components/workflow-editor/hooks/use-drag-drop.ts` (51 lines): reads `application/reactflow` drag data containing `{ type, label, config }`, converts screen→flow position, calls `addNode` with overrides.
- **Canvas** — `src/components/workflow-editor/workflow-canvas.tsx` (79 lines): registers 6 node types (`trigger`, `llm`, `judge`, `hitl`, `connector`, `condition`) + 1 custom edge type (`workflow`). Imports `@xyflow/react/dist/style.css`. Uses Controls, MiniMap, Background (dots), snap grid 16px, fitView, delete key binding.
- **Custom nodes** (`src/components/workflow-editor/nodes/*.tsx`): 6 node components, each with type-specific border color, icon (from lucide-react), Handle components. Branching nodes (judge, hitl, condition) have 2 source handles at 30%/70% positions with labels. All use `NodeProps<Node<WorkflowNodeData>>` and emit `selectNode(id)` on click.
- **Custom edge** — `src/components/workflow-editor/edges/workflow-edge.tsx` (84 lines): bezier edge with label display and hover delete button.
- **Block palette** — `src/components/workflow-editor/block-palette.tsx` (210 lines): 5 categories (Triggers, AI, Review, Actions, Logic). Each draggable item carries `{ type: stepType, label, config: dragData }` — so dropping "Email" creates an email connector (not generic Slack), dropping "Manual" creates a manual trigger, etc.
- **Config panel** — `src/components/workflow-editor/config-panel.tsx` (~795 lines): right-side panel showing per-type config forms. TriggerForm (triggerType select, datasetId), LLMForm (model, system/user prompt textareas, temperature slider, response format), JudgeForm (inputStepId select, threshold slider, dynamic criteria list with add/remove), HITLForm (instructions, show-steps toggles, auto-approve switch, judge/review target selects), ConnectorForm (connector type select, type-specific params), ConditionForm (expression textarea).
- **Toolbar** — `src/components/workflow-editor/toolbar.tsx` (155 lines): workflow name input, auto-layout button, delete selected button, save button (dirty/saving states), run button with JSON input dialog.
- **App pages** — `src/app/workflows/page.tsx` (list with empty state CTA), `src/app/workflows/new/page.tsx` (ReactFlowProvider wrapping editor layout), `src/app/workflows/[workflowId]/page.tsx` (same layout, loads existing workflow by ID).
- **shadcn UI components installed**: badge, button, card, collapsible, dialog, dropdown-menu, input, label, progress, scroll-area, select, separator, sheet, slider, switch, table, tabs, textarea, tooltip (19 components under `src/components/ui/`).

## Phase 6 Implementation Notes

- **Root layout** — `src/app/layout.tsx`: flex layout with `<Sidebar />` (w-60, hidden md:flex) + `<main className="flex-1 overflow-auto">`. Metadata: "Action".
- **Sidebar** — `src/components/layout/sidebar.tsx`: 4 nav links (Dashboard `/`, Workflows `/workflows`, Runs `/runs`, Review `/review`) with active state via `usePathname()`. Review badge count polled every 30s from `GET /api/review`. Mobile: hamburger + `Sheet` (side="left"). Extracted `NavContent` component reused in both desktop sidebar and mobile sheet.
- **Header** — `src/components/layout/header.tsx`: takes `title` + optional `breadcrumbs[]` with links.
- **Dashboard** — `src/app/page.tsx`: fetches workflows + runs in parallel. 4 stat cards (total workflows, total runs, pending reviews, success rate). Recent runs table (last 10, clickable rows). Quick actions: Create Workflow + Review Queue.
- **Run list** — `src/app/runs/page.tsx`: workflow filter dropdown (`Select`), delegates to `RunListTable`.
- **Run detail** — `src/app/runs/[runId]/page.tsx`: status section + step progress (`RunProgress`) + trace timeline (`TraceTimeline`). Polls every 3s while running/pending. Review link when `waiting_for_review`. Fetches workflow for step definitions.
- **Run components** — `run-status-badge.tsx` (color-coded badges), `run-list-table.tsx` (reusable table with duration), `run-progress.tsx` (Progress bar + step pills with status colors + current step ring).
- **Trace** — `trace-timeline.tsx`: vertical timeline with color-coded dots per event type, collapsible event details, delta time display, event summaries. `trace-event-detail.tsx`: type-specific rendering for LLM (model/tokens/prompt), judge (recommendation/confidence/criteria), connector (type/action/success), JSON fallback for others.
- **Review queue** — `src/app/review/page.tsx`: table with workflow name, truncated run ID, step name, instructions preview, time waiting, judge recommendation badge. Auto-refreshes every 10s. Empty state with UserCheck icon.
- **Review detail** — `src/app/review/[runId]/page.tsx`: fetches `ReviewItem`, handles 404/already-reviewed states, renders `ReviewPanel`.
- **Review panel** — `src/components/review/review-panel.tsx`: two-column grid (lg:grid-cols-2 when judge exists). Left: HITL instructions callout, prior step outputs (primary highlighted via `reviewTargetStepId`), collapsible workflow input. Right: `JudgeAssessment`. Bottom: comment textarea, Approve (green)/Edit & Approve (toggles `OutputEditor`)/Reject (confirmation dialog). Sends `targetStepId` with edit decisions.
- **Judge assessment** — `src/components/review/judge-assessment.tsx`: recommendation badge (pass/flag/fail), overall confidence bar (color: green >80%, amber >=50%, red <50%), criteria scores sorted ascending (worst first), issues in amber warning box, collapsible reasoning.
- **Output editor** — `src/components/review/output-editor.tsx`: detects string `result` field → textarea, otherwise JSON editor with parse validation.
- **Dynamic route params** — client components use `params: { runId: string }` directly (not Promise), server-side route handlers use `params: Promise<{ ... }>` with `await`.

## Phase 3 Implementation Notes

- `src/lib/connectors/slack.ts` — type: `"slack"`, action: `send_message`. Reads webhook from `params.webhookUrl` or `process.env.SLACK_WEBHOOK_URL`. POSTs JSON to webhook with text, optional channel/username/icon_emoji. Returns `{ success: false }` for missing URL, non-ok response, or network errors.
- `src/lib/connectors/http.ts` — type: `"http"`, action: `request`. Supports configurable method (default POST), authType (`"none"` / `"bearer"` / `"api-key"`), custom headers, and body. Parses response as JSON (falls back to text). Returns status + body for both success and error cases.
- `src/lib/connectors/email.ts` — type: `"email"`, action: `send_email`. Reads API key from `params.apiKey` or `process.env.RESEND_API_KEY`. POSTs to Resend API with from (default `Action <onboarding@resend.dev>`), to, subject, html, optional reply_to. Returns `{ emailId }` on success.
- `src/lib/connectors/notion.ts` — type: `"notion"`, actions: `create_page` (databaseId + properties → `{ pageId, url }`), `update_page` (pageId + properties → `{ pageId }`). Uses `@notionhq/client`. Auto-converts string → rich_text, number → number, boolean → checkbox; passes through Notion-native property objects as-is.
- `src/lib/connectors/google-sheets.ts` — type: `"google-sheets"`, actions: `append_row` (spreadsheetId, range, values → `{ updatedRange, updatedRows }`), `read_range` (spreadsheetId, range → `{ values, range }`). Uses `googleapis` with service account JSON auth. Auth client created inside each `execute()` call (not module scope).
- `src/lib/connectors/index.ts` — barrel file with side-effect imports of all 5 connectors, triggering `registerConnector()` on import. Imported by `src/lib/steps/connector.ts` (line 3).

## Phase 4 Implementation Notes

- **Workflow CRUD** — `src/app/api/workflows/route.ts` (GET list, POST create with UUID + timestamps) + `src/app/api/workflows/[workflowId]/route.ts` (GET, PUT partial merge, DELETE). Validates name on POST. `canvasState` stored for editor reopening.
- **Run routes** — `src/app/api/runs/route.ts` (GET with optional `?workflowId` filter sorted desc, POST validates workflowId + mode, rejects `mode="batch"` with helpful error, calls `startRun()`). `src/app/api/runs/[runId]/route.ts` (GET full run state). `src/app/api/runs/[runId]/resume/route.ts` (POST with `HITLDecision`, calls `resumeRun()`, smart error categorization).
- **Review routes** — `src/app/api/review/route.ts` exports `buildReviewItem()` helper that enriches `Run` → `ReviewItem` (workflow name, current HITL step, prior step outputs from `showSteps`, judge assessment if present). GET returns all `waiting_for_review` runs sorted oldest-first. `src/app/api/review/[runId]/route.ts` (GET single ReviewItem, POST decision with action validation → `resumeRun()`).
- **Trace route** — `src/app/api/runs/[runId]/trace/route.ts` — uses `readJsonArray(getTracePath(runId))`.
- **Dataset routes** — `src/app/api/datasets/route.ts` + `src/app/api/datasets/[datasetId]/route.ts` — delegate to `src/lib/datasets/loader.ts`. Pagination via `?limit=10&offset=0` (max 100).
- **Dataset loader** — `src/lib/datasets/loader.ts` — scans `data/datasets/` for `{ config: DatasetConfig, items: unknown[] }` JSON files. Exports `listDatasets()` and `getDataset(id, { offset, limit })`. Graceful empty returns if dir missing or files malformed.
- **Error contract** — all routes return `{ error: string, code: "NOT_FOUND" | "INVALID_INPUT" | "ENGINE_ERROR" }` with appropriate HTTP status codes (200/201/400/404/500).
- **Next.js 16 pattern** — all dynamic route handlers use `params: Promise<{ ... }>` with `await params`.

## Phase 7.1 Implementation Notes

- **Header** — `src/components/layout/header.tsx`: extended with optional `actions?: ReactNode` and `badge?: ReactNode` props. Title + badge in flex row, actions pushed right. Backward-compatible (Dashboard/Runs pass no extra props).
- **Unified layouts** — Workflows and Review pages switched from `max-w-5xl mx-auto py-12 px-8` to `<Header>` + `<div className="p-8 space-y-6">`, matching Dashboard/Runs. All 4 main pages now share the same layout pattern.
- **Orange accent system** — Primary action buttons (Run, New Workflow, Start Run) use `bg-orange-500 hover:bg-orange-600 text-white font-heading`. Dashboard quick action arrows use `group-hover:text-orange-500`. Consistent across all pages.
- **Toolbar** — Title/description are borderless `<input>` elements (no rounded box chrome). Auto-layout/Delete/Save use `variant="ghost"` with `text-muted-foreground`. Run button uses orange + Baskerville.
- **Config panel** — Background `bg-muted/30`, header retains `bg-background`. All form fields use `bg-muted/50 border-transparent` (tinted fill, no white-on-white). All `<Label>` elements use `font-heading` (Baskerville). Empty state: circular icon badge + branded copy.
- **Dropdown menu** — `src/components/ui/dropdown-menu.tsx` installed via shadcn CLI. Workflows page uses `MoreHorizontal` trigger with "Edit workflow" / "Delete workflow" items. Workflow table rows are clickable.
- **Dashboard stat cards** — Removed icons. Title `text-sm font-medium`, number `text-4xl`. "Total Runs" and "Success Rate" cards have `<Separator>` + sub-metrics rows. 4 explicit cards (not mapped from array).
- **Runs table** — Removed Actions/Eye column (row click handles navigation). 4 columns: Workflow Name, Status, Started, Duration.
- **React Flow canvas** — `proOptions={{ hideAttribution: true }}` hides watermark. `showInteractive={false}` removes lock button. Custom CSS in `globals.css` styles controls: rounded container, 28px buttons, muted icons.
- **Branded empty states** — All empty states use `<span className="font-heading italic">Action</span>` (capital A, italic Baskerville): Review ("take *Action*"), Workflows ("put it into *Action*"), Dashboard/Runs ("Put a workflow into *Action*"), Config panel ("take *Action*").
