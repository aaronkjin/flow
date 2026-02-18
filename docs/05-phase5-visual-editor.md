# Phase 5: Visual Workflow Editor (~3 hours)

## Goal

Build the React Flow-based visual workflow editor where users compose workflows by dragging and connecting blocks on a canvas.

## Tasks

### 5.1 React Flow Canvas Setup (30 min)

**File**: `src/components/workflow-editor/workflow-canvas.tsx`

- Full-screen React Flow canvas with background grid
- Controls: zoom, pan, minimap, fit view
- Node types registered: trigger, llm, judge, hitl, connector, condition
- Edge type registered: custom workflow edge
- Snap to grid enabled
- Delete key removes selected nodes/edges
- Undo/redo support via state history

### 5.2 Custom Node Components (45 min)

**Files**: `src/components/workflow-editor/nodes/*.tsx`

6 custom node types, each as a React component:

| Node | Visual | Handles |
|------|--------|---------|
| `trigger-node.tsx` | Dark bg, Play icon, "Trigger" label, dataset name | 1 output (bottom) |
| `llm-node.tsx` | Blue bg, Sparkles icon, "LLM" label, model name | 1 input (top), 1 output (bottom) |
| `judge-node.tsx` | Amber bg, Scale icon, "Judge" label, threshold | 1 input (top), 2 outputs (pass/flag) |
| `hitl-node.tsx` | Green bg, User icon, "HITL Review" label | 1 input (top), 2 outputs (approve/reject) |
| `connector-node.tsx` | Purple bg, Plug icon, connector type label | 1 input (top), 1 output (bottom) |
| `condition-node.tsx` | Gray bg, GitBranch icon, expression preview | 1 input (top), 2 outputs (yes/no) |

Each node:
- Uses shadcn/ui Card as base
- Shows icon + type badge + brief config summary
- Has color-coded border/accent matching its type
- Highlights when selected
- Shows validation warnings (missing config)

### 5.3 Block Palette (30 min)

**File**: `src/components/workflow-editor/block-palette.tsx`

Left sidebar with draggable blocks grouped by category:

- **Triggers**: Dataset replay, Manual, Webhook
- **AI**: LLM Action, Judge
- **Review**: HITL Review
- **Actions**: Slack, Email, HTTP Webhook, Notion, Google Sheets
- **Logic**: Condition

Each palette item:
- Icon + label + brief description
- Draggable (HTML5 DnD or dnd-kit)
- On drop to canvas: creates new node at drop position with default config

### 5.4 Config Panel (45 min)

**File**: `src/components/workflow-editor/config-panel.tsx`

Right sidebar that shows configuration form for the selected node:

**Trigger config**:
- Dataset picker (dropdown)
- Or manual input fields

**LLM config**:
- Model selector (gpt-4o-mini, gpt-4o, etc.)
- System prompt (textarea with syntax highlighting for {{variables}})
- User prompt (textarea)
- Temperature slider
- Response format toggle (text/JSON)

**Judge config**:
- Input step reference (dropdown of prior steps)
- Criteria list (add/remove criteria with name, description, weight)
- Threshold slider (0-1)
- Model selector

**HITL config**:
- Reviewer instructions (textarea)
- Steps to show (multi-select of prior steps)
- Auto-approve on judge pass (toggle)
- Judge step reference for auto-approve (dropdown)
- Target step to overwrite when reviewer edits (dropdown of prior steps)

**Connector config**:
- Connector type dropdown (Slack, Email, HTTP, Notion, Sheets)
- Type-specific fields appear based on selection
- All text fields support {{variable}} interpolation

**Condition config**:
- Expression field (e.g., `{{steps.judge.recommendation}} === "pass"`)
- Yes/No labels

### 5.5 Canvas ↔ JSON Serialization (20 min)

**File**: `src/components/workflow-editor/hooks/use-workflow.ts`

State management hook:

- `useWorkflow()` hook manages:
  - React Flow nodes and edges state
  - Workflow metadata (name, description)
  - Dirty state tracking
  - Save function: serializes nodes/edges → WorkflowDefinition → POST/PUT API
  - Load function: fetches workflow → deserializes to nodes/edges
- Serialization logic:
  - Each RF node → `StepDefinition` (node.data → step config)
  - Each RF edge → `EdgeDefinition`
  - Canvas positions saved as `canvasState` for reopening

### 5.6 Toolbar + Auto-Layout (10 min)

**File**: `src/components/workflow-editor/toolbar.tsx`

Top toolbar:
- Workflow name (editable inline)
- Save button (calls useWorkflow.save())
- Run button (opens modal: select input method → POST /api/runs)
- Auto-layout button (runs dagre on current graph, animates reposition)
- Undo/redo buttons

### 5.7 DnD Hook (included in palette)

**File**: `src/components/workflow-editor/hooks/use-drag-drop.ts`

- Handles onDragStart from palette items
- Handles onDrop on canvas: calculates position, creates new node with default config
- Uses React Flow's screenToFlowPosition() for accurate placement

## Key Libraries

- `@xyflow/react` v12+ — canvas, nodes, edges, controls, minimap
- `@dagrejs/dagre` — auto-layout algorithm (top-to-bottom DAG)

## Verification

- [ ] Canvas renders with grid background and controls
- [ ] All 6 node types render with correct colors and handles
- [ ] Dragging from palette creates nodes on canvas
- [ ] Connecting nodes creates edges with correct handle mapping
- [ ] Clicking a node opens config panel with correct form
- [ ] Save serializes canvas → valid WorkflowDefinition JSON
- [ ] Load deserializes WorkflowDefinition → correct canvas state
- [ ] Auto-layout arranges nodes top-to-bottom
- [ ] Run button triggers execution via API
