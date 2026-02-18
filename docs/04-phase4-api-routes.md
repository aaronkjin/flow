# Phase 4: API Routes (~1.5 hours)

## Goal

Build all Next.js API routes that the frontend will consume. These form the contract between the visual editor/dashboard and the core engine.

## Tasks

### 4.1 Workflow CRUD (25 min)

**Files**:
- `src/app/api/workflows/route.ts` — GET (list all), POST (create)
- `src/app/api/workflows/[workflowId]/route.ts` — GET, PUT, DELETE

Endpoints:

```
GET    /api/workflows              → { workflows: WorkflowDefinition[] }
POST   /api/workflows              → { workflow: WorkflowDefinition }
         Body: { name, description, steps, edges, canvasState }

GET    /api/workflows/:id          → { workflow: WorkflowDefinition }
PUT    /api/workflows/:id          → { workflow: WorkflowDefinition }
         Body: { name?, description?, steps?, edges?, canvasState? }
DELETE /api/workflows/:id          → { success: true }
```

- `canvasState` stores React Flow node positions + viewport for reopening editor
- On POST: generate UUID, set createdAt/updatedAt
- On PUT: update updatedAt timestamp

### 4.2 Run Execution (25 min)

**Files**:
- `src/app/api/runs/route.ts` — GET (list all), POST (start new run)
- `src/app/api/runs/[runId]/route.ts` — GET (status/detail)
- `src/app/api/runs/[runId]/resume/route.ts` — POST (resume after HITL)

Endpoints:

```
GET    /api/runs                   → { runs: Run[] }
         Query: ?workflowId=xxx (optional filter)

POST   /api/runs                   → { run: Run }
         Body: { workflowId, input, mode: "single" | "batch" }
         - mode "single": runs with provided input
         - mode "batch": runs with dataset (future: parallel)

GET    /api/runs/:id               → { run: Run }
         Returns full run state including all stepStates

POST   /api/runs/:id/resume        → { run: Run }
         Body: { decision: HITLDecision }
         Calls engine.resumeRun()
```

- POST /api/runs fires engine.startRun() and returns immediately
- Frontend polls GET /api/runs/:id every 2s for status updates

### 4.3 Review Endpoints (20 min)

**Files**:
- `src/app/api/review/route.ts` — GET (pending reviews)
- `src/app/api/review/[runId]/route.ts` — POST (submit decision)

Endpoints:

```
GET    /api/review                 → { reviews: ReviewItem[] }
         Returns all runs with status "waiting_for_review"
         Each ReviewItem includes: run, workflow name, current step,
         prior step outputs (for context), judge assessment (if any)

POST   /api/review/:runId          → { run: Run }
         Body: { action: "approve" | "edit" | "reject", editedOutput?, comment? }
         Delegates to engine.resumeRun()
```

- `ReviewItem` is an enriched view for the frontend — includes everything the reviewer needs

### 4.4 Trace + Dataset Endpoints (20 min)

**Files**:
- `src/app/api/runs/[runId]/trace/route.ts` — GET trace events
- `src/app/api/datasets/route.ts` — GET available datasets
- `src/app/api/datasets/[datasetId]/route.ts` — GET dataset items

Endpoints:

```
GET    /api/runs/:id/trace         → { events: TraceEvent[] }
         Returns all trace events for a run in chronological order

GET    /api/datasets               → { datasets: DatasetConfig[] }
         Returns available datasets (demo + user-uploaded)

GET    /api/datasets/:id           → { dataset: DatasetConfig, items: any[] }
         Returns dataset config + first N items
         Query: ?limit=10&offset=0
```

## Error Handling

All routes follow consistent error response format:
```json
{
  "error": "Human-readable error message",
  "code": "NOT_FOUND" | "INVALID_INPUT" | "ENGINE_ERROR"
}
```

Status codes:
- 200: Success
- 201: Created
- 400: Invalid input
- 404: Not found
- 500: Internal error

## Verification

- [ ] POST /api/workflows creates a workflow and returns it with an ID
- [ ] GET /api/workflows lists all workflows
- [ ] POST /api/runs starts a run and returns immediately with pending status
- [ ] GET /api/runs/:id returns run with updated status after execution
- [ ] GET /api/review returns runs waiting for review
- [ ] POST /api/review/:runId with approve continues the run
- [ ] GET /api/runs/:id/trace returns trace events
