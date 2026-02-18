# Action — Implementation Spec & Delegation Plan

## Purpose

Translate `docs/PLAN.md` into executable work packages that multiple coding subagents can pick up in one shot. Each task lists prerequisite reading, files to touch, files to avoid, sequencing guidance, and completion checks. Also see `docs/INSTRUCTIONS.md` for the original brief and skateboard mindset.

## Task Graph Overview

| Phase | Focus                                     | Must Finish Before                      | Parallelizable Segments                                                                                                                           |
| ----- | ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Core scaffold (types, stores, engine)     | Kicks off Phase 2+                      | 1.3 JSON Store can run in parallel with 1.2 types once scaffolding exists; 1.4 interpolation can run alongside 1.5 engine after context handshake |
| 2     | Step executors (LLM/Judge/HITL/Connector) | Needed before API routes + runs         | 2.2/2.3 can proceed after 2.1 shapes types; 2.4 depends on registry (Phase 3) but stub allowed                                                    |
| 3     | Real connectors                           | Must precede workflows + review tooling | Slack/HTTP/Email can be built in parallel; Notion/Sheets best sequential due to shared auth helper                                                |
| 4     | API routes                                | Required before UI pages & run surfaces | Each sub-route can be implemented independently after data contracts are final                                                                    |
| 5     | Visual workflow editor                    | Needs routes + types                    | Nodes/palette/config panel can run in parallel once canvas shell exists                                                                           |
| 6     | Dashboard + HITL UI + Trace               | Requires API + engine events            | Dashboard + runs pages can share hooks; trace + review panel can progress simultaneously                                                          |
| 7     | Demo workflows + datasets                 | Needs editor, engine, connectors        | Dataset loader independent once persistence ready; building sample workflows happens entirely in UI                                               |
| 8     | Polish + README                           | Final hardening                         | Error handling + README writing can run simultaneously                                                                                            |

> **Delegation rule of thumb:** before dispatching Phase N tasks, confirm all blocking subtasks in Phase N-1 are verified in traces/tests.

## Delegation Packs

### Phase 1 — Foundation

**Context references:** `docs/01-phase1-foundation.md`, `docs/CLAUDE.md`, `docs/PLAN.md`. Always scaffold under `src/lib/**` per repo layout.

#### Task 1.1 — Next.js + Dependency Scaffold [DONE]

- **Objective:** Initialize Next.js App Router project, install dependencies (Tailwind, shadcn/ui, @xyflow/react, @dagrejs/dagre, openai, uuid), and seed directory structure.
- **Modify:** `package.json`, `package-lock.json`, Tailwind config, `src/app/layout.tsx`, `.gitignore`, create empty directories under `src/` + `data/`.
- **Do not modify:** `docs/**`.
- **Notes:** shadcn/ui initialized with default theme (the `--style` flag was removed in shadcn v3.8+). `data/` is gitignored. No barrel `index.ts` files created — modules import directly.
- **Validation:** `npm run dev` boots; `src` tree matches plan.
- **Result:** Next.js 16.1.6, React 19.2, Tailwind v4, @xyflow/react v12, @dagrejs/dagre v2, openai SDK, uuid all installed and working.

#### Task 1.2 — Core Types [DONE]

- **Objective:** Define all foundational TypeScript types (`WorkflowDefinition`, `StepDefinition`, `Run`, `TraceEvent`, `JudgeResult`, etc.) in `src/lib/engine/types.ts`.
- **Modify:** `src/lib/engine/types.ts`.
- **Read for context:** `docs/00-overview.md` (architecture), `docs/01-phase1-foundation.md`.
- **Do not modify:** Execution logic or UI files.
- **Notes:** Uses `StepConfig` union type discriminated by `type` field. Status types are string literal unions (`RunStatus`, `StepStatus`). All types imported directly from `@/lib/engine/types`.
- **Validation:** TypeScript builds cleanly. All engine/step files import from types.ts.

#### Task 1.3 — JSON Persistence Layer [DONE]

- **Objective:** Implement `JsonStore` + helpers in `src/lib/persistence/store.ts`.
- **Result:** Generic `JsonStore<T extends { id: string }>` with in-memory cache, lazy load-all-on-first-access, write-through to disk. Singleton getters `getWorkflowStore()`, `getRunStore()`, `getTracePath()`. Also `appendToJsonArray()` and `readJsonArray()` for traces.

#### Task 1.4 — Interpolation Engine [DONE]

- **Objective:** `src/lib/engine/interpolation.ts` with `interpolate`, `interpolateObject`, and `evaluateCondition`.
- **Result:** `interpolate()` resolves `{{path.to.value}}` via safe string parsing (no eval). `interpolateObject()` recurses through objects/arrays. `evaluateCondition()` supports comparison operators (`===`, `!==`, `>`, `<`, `>=`, `<=`) and boolean/truthy evaluation. Handles quoted strings and numeric comparisons.

#### Task 1.5 — Execution Engine [DONE]

- **Objective:** `src/lib/engine/engine.ts` — core execution engine.
- **Result:** Exports `startRun()`, `resumeRun()`, `reconcileStaleRuns()`, and `topologicalSort()`. Uses Kahn's algorithm for topological ordering. Step executors are dispatched via dynamic `import()` (avoids circular deps, allows Phase 2 stubs). HITL pause/resume works: engine detects `{ __hitlPause: true }` return and stops. `autoApproveOnJudgePass` is handled inside the engine's HITL dispatch (not in hitl.ts), checking prior judge step output. Branch-skip logic handles condition, judge (pass/flag), and HITL (approve/reject) source handles. Trace events emitted via `appendToJsonArray` after every state transition.

### Phase 2 — Step Executors

**Context:** `docs/02-phase2-step-executors.md`, `CLAUDE.md`. Requires Phase 1 types/interpolation done.

#### Task 2.1 — LLM Step Executor [DONE]

- **Result:** `src/lib/steps/llm.ts` — OpenAI chat completions via `openai` v6. Reads `OPENAI_API_KEY` at call time (not module level). 30s timeout. JSON mode via `response_format: { type: "json_object" }` when `responseFormat === "json"`. Appends JSON instruction to system prompt if not already present. Returns `{ result, model, usage: { promptTokens, completionTokens, totalTokens } }`. Graceful JSON parse failure returns `{ result: rawContent, parseError }`.

#### Task 2.2 — Judge Step Executor [DONE]

- **Result:** `src/lib/steps/judge.ts` — LLM-as-judge via same OpenAI pattern. Reads `context.steps[inputStepId]` for content to evaluate. Structured system prompt with JSON schema, criteria block in user message. Low temperature (0.3). Threshold-based recommendation override: `>= threshold` → pass, `>= threshold * 0.6` → flag, below → fail. Parse failure fallback: `recommendation: "flag"`, `overallConfidence: 0`.

#### Task 2.3 — HITL Step Executor [DONE]

- **Result:** `src/lib/steps/hitl.ts` — returns `{ paused: true }`. All real HITL logic (auto-approve, resume, edit propagation) is in `engine.ts`.

#### Task 2.4 — Connector Dispatch Step [DONE]

- **Result:** `src/lib/steps/connector.ts` — dispatches to `getConnector(connectorType)` from registry. Throws descriptive error with available types if connector not found. Wraps `connector.execute()` in try/catch. Checks `result.success`. Returns `{ connectorType, action, success: true, ...result.data }`.
- `src/lib/connectors/registry.ts` — module-level `Map<string, Connector>`. Exports `registerConnector()`, `getConnector()`, `getRegisteredTypes()`.

### Phase 3 — Real Connectors

**Context:** `docs/03-phase3-connectors.md`. Registry already implemented in Phase 2 (`src/lib/connectors/registry.ts`).

1. ~~**Registry & Base Interfaces**~~ [DONE in Phase 2] — `registerConnector()`, `getConnector()`, `getRegisteredTypes()` all working.
2. **Slack Connector** [DONE] — `src/lib/connectors/slack.ts`: type `"slack"`, action `send_message`. Reads webhook from params or `SLACK_WEBHOOK_URL` env. Graceful `{ success: false }` errors.
3. **HTTP/Webhook Connector** [DONE] — `src/lib/connectors/http.ts`: type `"http"`, action `request`. Configurable method, auth (none/bearer/api-key), headers, body. JSON response parsing with text fallback.
4. **Email/Resend Connector** [DONE] — `src/lib/connectors/email.ts`: type `"email"`, action `send_email`. Reads API key from params or `RESEND_API_KEY` env. POSTs to Resend API, returns `{ emailId }`.
5. **Notion Connector** [DONE] — `src/lib/connectors/notion.ts`: type `"notion"`, actions `create_page`/`update_page`. Uses `@notionhq/client`. Auto-converts primitive types to Notion property format, passes through native objects.
6. **Google Sheets Connector** [DONE] — `src/lib/connectors/google-sheets.ts`: type `"google-sheets"`, actions `append_row`/`read_range`. Uses `googleapis` with service account JSON auth. Auth client created per-call.
7. **Barrel File** [DONE] — `src/lib/connectors/index.ts`: side-effect imports all 5 connectors, triggering `registerConnector()`. Already imported by `connector.ts` step executor.
8. **Guardrails verified:** No embedded API keys. All secrets read from `process.env` at call time. Missing credentials return `{ success: false }` with actionable error messages (no throws).

### Phase 4 — API Routes

**Context:** `docs/04-phase4-api-routes.md`. Requires engine + stores + step executors.

#### Task 4.1 — Workflow CRUD [DONE]

- **Result:** `src/app/api/workflows/route.ts` (GET list, POST create with UUID + timestamps, name validation) + `src/app/api/workflows/[workflowId]/route.ts` (GET, PUT partial merge with `updatedAt`, DELETE). All use `getWorkflowStore()`.

#### Task 4.2 — Run Execution + Resume [DONE]

- **Result:** `src/app/api/runs/route.ts` (GET with `?workflowId` filter sorted desc, POST validates workflowId + mode, rejects batch, calls `startRun()` → 201). `src/app/api/runs/[runId]/route.ts` (GET full state). `src/app/api/runs/[runId]/resume/route.ts` (POST `HITLDecision` → `resumeRun()`, smart error categorization).

#### Task 4.3 — Review Endpoints [DONE]

- **Result:** `src/app/api/review/route.ts` (GET enriched `ReviewItem[]` for `waiting_for_review` runs, sorted oldest-first, exports `buildReviewItem()` helper). `src/app/api/review/[runId]/route.ts` (GET single ReviewItem, POST decision with action validation → `resumeRun()`).

#### Task 4.4 — Trace + Dataset Endpoints [DONE]

- **Result:** `src/app/api/runs/[runId]/trace/route.ts` (GET via `readJsonArray`). `src/app/api/datasets/route.ts` + `src/app/api/datasets/[datasetId]/route.ts` (delegate to `src/lib/datasets/loader.ts` with pagination). Dataset loader scans `data/datasets/` for `{ config, items }` JSON files, validates shape, graceful empty returns.

- **Error contract:** All routes return `{ error, code }` with `NOT_FOUND` / `INVALID_INPUT` / `ENGINE_ERROR` and appropriate HTTP status codes.
- **Next.js 16 pattern:** All dynamic route handlers use `params: Promise<{...}>` with `await params`.

### Phase 5 — Visual Workflow Editor

**Context:** `docs/05-phase5-visual-editor.md`.

1. **Canvas shell** [DONE] — `src/components/workflow-editor/workflow-canvas.tsx`: React Flow with 6 node types + custom edge, Controls, MiniMap, Background, snap grid, fitView, delete key, DnD.
2. **Custom nodes** [DONE] — `src/components/workflow-editor/nodes/`: 6 node components (trigger, llm, judge, hitl, connector, condition) with type-specific borders, icons, handles. Branching nodes have dual source handles at 30%/70%.
3. **Block palette + DnD** [DONE] — `src/components/workflow-editor/block-palette.tsx` (5 categories, drag data with block semantics) + `hooks/use-drag-drop.ts` (screenToFlowPosition, addNode with overrides).
4. **Config panel** [DONE] — `src/components/workflow-editor/config-panel.tsx` (~795 lines): per-type forms for all 6 step types. Judge has dynamic criteria list. HITL has show-steps toggles, auto-approve, judge/review target selects.
5. **Serialization hook** [DONE] — `src/components/workflow-editor/hooks/use-workflow.ts` (525 lines): full UseWorkflowReturn interface. Node CRUD with label+configOverrides, serialization, API persistence (POST/PUT), run execution, dagre layout, dirty tracking.
6. **Toolbar** [DONE] — `src/components/workflow-editor/toolbar.tsx`: name input, auto-layout, delete, save (dirty/saving), run dialog with JSON input.
7. **App pages** [DONE] — `src/app/workflows/page.tsx` (list + empty state), `src/app/workflows/new/page.tsx` (create), `src/app/workflows/[workflowId]/page.tsx` (edit).
8. **Custom edge** [DONE] — `src/components/workflow-editor/edges/workflow-edge.tsx`: bezier with label + hover delete button.

### Phase 6 — Dashboard, Runs, Review, Trace

**Context:** `docs/06-phase6-ui-pages.md`.

1. **Root layout + Sidebar** [DONE] — `src/app/layout.tsx` (flex + sidebar + main), `src/components/layout/sidebar.tsx` (4 nav links, active state, review badge count polled 30s, mobile Sheet), `src/components/layout/header.tsx` (title + breadcrumbs).
2. **Dashboard** [DONE] — `src/app/page.tsx`: 4 stat cards, recent runs table (last 10), quick actions. Parallel fetch of workflows + runs.
3. **Run list** [DONE] — `src/app/runs/page.tsx`: workflow filter Select, `RunListTable` component.
4. **Run detail** [DONE] — `src/app/runs/[runId]/page.tsx`: status section, step progress (`RunProgress`), embedded trace timeline, 3s polling, review link. Fetches workflow for step definitions.
5. **Run components** [DONE] — `run-status-badge.tsx` (5 status variants), `run-list-table.tsx` (table with duration), `run-progress.tsx` (Progress bar + step pills).
6. **Trace timeline** [DONE] — `trace-timeline.tsx` (vertical timeline, color-coded dots, collapsible details, delta times), `trace-event-detail.tsx` (type-specific: LLM/judge/connector/JSON fallback).
7. **Review queue** [DONE] — `src/app/review/page.tsx`: table with workflow/runId/step/instructions/waiting/judge. 10s auto-refresh. Empty state.
8. **Review panel** [DONE] — `src/app/review/[runId]/page.tsx` + `review-panel.tsx` (two-column, action bar with approve/edit/reject, sends targetStepId) + `judge-assessment.tsx` (confidence bars, criteria, issues, reasoning) + `output-editor.tsx` (string/JSON editing).

- **Client dynamic routes** use `params: { runId: string }` directly (not Promise). Server route handlers continue using `params: Promise<{...}>` with `await`.

### Phase 7 — Demo Integration

**Context:** `docs/07-phase7-demo-integration.md`.

1. **Dataset loader** [DONE in Phase 4] — `src/lib/datasets/loader.ts` already scans `data/datasets/` for `{ config, items }` JSON files.
2. **Demo datasets** [DONE] — `data/datasets/it-tickets.json` (50 IT helpdesk tickets) + `data/datasets/resumes.json` (50 resume summaries). Created by seed script.
3. **Demo workflows** [DONE] — `data/workflows/demo-it-ticket-triage.json` (Trigger→LLM→Judge→HITL→Slack+Email) + `data/workflows/demo-resume-screening.json` (Trigger→LLM→Judge→HITL→Sheets+Notion). Created by seed script.
4. **Seed script** [DONE] — `scripts/seed-demo.ts` (run via `npm run seed` / `npx tsx scripts/seed-demo.ts`). Idempotent, writes datasets + workflows to `data/`.

### Phase 7.1 — Design Overhaul (Apple-Level Aesthetic)

**Context:** `docs/07.1-phase7.1-design-overhaul.md`.

Pure visual/design pass — NO functionality changes. Transform every UI page and component to feel like an Apple product.

Key changes:

- **Typography**: Libre Baskerville for headings (with italic-on-hover), Inter for body, Geist Mono for code
- **Color**: Restrained palette — muted status colors, subtle borders, deep charcoal text
- **Spacing**: Generous whitespace, breathing room, airy layouts
- **Components**: Softer shadows, refined badges, cleaner tables, subtle node borders
- ~29 files modified across globals, layout, pages, shared components, and workflow editor

Rules: Every feature, API call, and state flow must remain identical. No component API changes.

Status: [DONE] — all ~29 files updated with Baskerville headings, Inter body, muted status colors, orange accent system, refined nodes/badges/timeline, generous whitespace.

### Phase 7.2 — Keyboard Navigation

**Context:** `docs/07.2-phase7.2-keyboard-navigation.md`.

Add keyboard-driven navigation throughout the app.

Key additions:
- **Shared hook**: `src/hooks/use-keyboard-nav.ts` — reusable ArrowUp/Down/Enter navigation with focused index, scroll-into-view, input detection
- **List pages**: Workflows, Runs, Reviews, Dashboard — Up/Down moves focus, Enter selects/navigates
- **Block palette**: Up/Down through blocks, Enter adds to canvas
- **Editor zones**: Left/Right switches focus between palette, canvas, and config panel
- ~9 files modified (1 created, 8 modified)

Rules: No functionality changes. No layout changes. Keyboard nav must not interfere with form inputs or React Flow keyboard controls.

### Phase 8 — Polish + README

**Context:** `docs/08-phase8-polish.md`.

- **Error-handling sweep**: guard connectors, API routes, UI states for missing data.
- **README authoring**: Replace scaffold README with Action-specific doc (overview, quick start, architecture, demo walkthrough, env vars, structure).
- **Final QA**: Smoke test entire flow, ensure `.gitignore` excludes runtime data, remove unused deps.

## General Rules for Any Task

1. **Read before acting:** consult `CLAUDE.md`, `SPEC.md`, `PLAN.md`, and the phase doc that matches your work.
2. **Scope discipline:** if a task feels like it creeps into a future phase, pause and confirm with the coordinator.
3. **No cross-file surprises:** only touch files listed in your task unless you coordinate; leave a short comment in PR/commit note when you must touch extras.
4. **Document outcomes:** update relevant doc (phase file or CLAUDE) if you introduce new contracts, env vars, or workflows.
5. **Testing:** at minimum run `npm run lint` and manual verifications listed per phase; add automated tests when practical.

With this spec, coordinators can assign tasks like "Phase 1 — Task 1.4" directly, and subagents can execute with confidence about inputs, outputs, and dependencies.
