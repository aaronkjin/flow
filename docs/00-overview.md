# Action — Overview

## What is Action?

Action is a knowledge work automation platform. Users visually compose workflows by dragging and connecting blocks on a canvas. The platform translates that visual graph into a JSON workflow definition internally, then executes it through a generalizable engine with LLM steps, LLM-as-judge quality gates, HITL (Human-in-the-Loop) review, and real-world connectors.

## User Flow

```
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
```

Users NEVER see raw JSON/YAML — the visual editor is the only authoring interface.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Web UI (Next.js)                        │
│                                                            │
│  ┌─────────────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │  Visual Workflow │ │   Run    │ │   HITL Review     │  │
│  │  Editor (React   │ │Dashboard │ │   Panel           │  │
│  │  Flow canvas)    │ │          │ │                   │  │
│  └─────────────────┘ └──────────┘ └───────────────────┘  │
│  ┌─────────────────┐                                      │
│  │  Trace Viewer    │                                      │
│  └─────────────────┘                                      │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────┐
│                    Next.js API Routes                      │
│  /api/workflows  /api/runs  /api/review  /api/datasets     │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────┐
│                    Core Engine (lib/)                       │
│                                                            │
│  Execution Engine │ Step Executors │ Real Connectors        │
│  Interpolation    │ JSON Persist.  │ Trace Store            │
└──────────────────────────────────────────────────────────┘
```

## Stack

- **Next.js App Router** — Full-stack React framework
- **TypeScript** — Type safety throughout
- **shadcn/ui + Tailwind CSS** — UI components and styling
- **React Flow (@xyflow/react)** — Node-based visual canvas
- **OpenAI API** — LLM calls for worker and judge steps
- **JSON file persistence** — Zero-setup storage for demo scale

## Key Design Decisions

| Decision                      | Rationale                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- |
| React Flow for visual editor  | Industry standard for node-based UIs. MIT, ~42kB, first-class TypeScript. |
| Canvas auto-generates JSON    | Users never write YAML/JSON. Visual graph is source of truth.             |
| Real connectors, not stubs    | All 5 use API keys or webhooks (zero OAuth). Makes demo compelling.       |
| JSON files for persistence    | Zero setup, inspectable, fast for demo scale.                             |
| Next.js API routes as backend | Single deployment. Engine runs as async Promise in same process.          |
| Polling for status updates    | Frontend polls every 2s. Simpler than WebSockets. Adequate for demo.      |
