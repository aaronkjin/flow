# Phase 6: HITL Review + Dashboard + Trace Viewer (~2.5 hours)

## Goal

Build the dashboard, run management pages, trace viewer, and the full HITL review experience.

## Tasks

### 6.1 Dashboard Page (25 min)

**File**: `src/app/page.tsx`

Main landing page with:

- Stats cards: Total workflows, Total runs, Pending reviews, Success rate
- Recent runs table (last 10): workflow name, status badge, started, duration
- Quick actions: Create workflow, View review queue
- Fetches from GET /api/workflows and GET /api/runs

### 6.2 Run List + Run Detail (25 min)

**Files**:

- `src/app/runs/page.tsx` — All runs dashboard
- `src/app/runs/[runId]/page.tsx` — Run detail + trace
- `src/components/run/run-list-table.tsx` — Reusable table
- `src/components/run/run-status-badge.tsx` — Color-coded status
- `src/components/run/run-progress.tsx` — Step progress indicator

Run list page:

- Filterable by workflow, status
- Sortable by date
- Status badges: pending (gray), running (blue pulse), waiting_for_review (amber), completed (green), failed (red)

Run detail page:

- Header: workflow name, run ID, status, timestamps
- Step progress bar showing completed/current/remaining steps
- Embedded trace timeline (below)
- Link to review panel if waiting_for_review

### 6.3 Trace Timeline Viewer (30 min)

**Files**:

- `src/components/trace/trace-timeline.tsx` — Vertical timeline
- `src/components/trace/trace-event-detail.tsx` — Expandable event detail

Vertical timeline showing:

- Each trace event as a timeline node
- Event types: step_started, step_completed, step_failed, llm_call, judge_result, hitl_paused, hitl_resumed, connector_fired
- Each node shows: timestamp, step name, event type icon, brief summary
- Click to expand: full input/output data, LLM tokens used, judge scores, connector response
- Color-coded by event type
- Duration between events shown on connecting lines
- Auto-scrolls to latest event for running workflows

### 6.4 Review Queue Page (20 min)

**File**: `src/app/review/page.tsx`

List of runs waiting for human review:

- Each item shows: workflow name, run input summary, time waiting, current step
- Badge count in sidebar navigation
- Click to open review panel
- Auto-refreshes via polling

### 6.5 Review Panel (40 min)

**Files**:

- `src/app/review/[runId]/page.tsx` — Review page
- `src/components/review/review-panel.tsx` — Main review interface
- `src/components/review/judge-assessment.tsx` — Judge result display
- `src/components/review/output-editor.tsx` — Editable output

Review panel layout (side-by-side):

**Left side — LLM Output**:

- Shows the output from the step being reviewed
- Formatted display (markdown for text, table for structured data)
- For "edit" action: switches to editable textarea/editor

**Right side — Judge Assessment** (if judge step exists):

- Overall confidence bar (0-100%)
- Per-criterion score bars with labels
- Flagged issues list with severity
- Judge reasoning text
- Recommendation badge (pass/flag/fail)

**Bottom — Action Bar**:

- Approve button (green) — continues workflow
- Edit & Approve button (blue) — opens editor, then continues with edited output
- Reject button (red) — fails the workflow
- Comment textarea — optional note for audit trail
- Keyboard shortcuts: Cmd+Enter (approve), Cmd+E (edit), Cmd+Backspace (reject)

### 6.6 Sidebar + Layout (10 min)

**Files**:

- `src/components/layout/sidebar.tsx` — Nav sidebar
- `src/components/layout/header.tsx` — Breadcrumbs

Sidebar navigation:

- Dashboard (home icon)
- Workflows (workflow icon)
- Runs (play icon)
- Review (user-check icon) — with pending count badge
- Collapsible on mobile
- Active state highlighting

Header:

- Breadcrumbs based on current route
- Action logo/wordmark

## Verification

- [ ] Dashboard shows accurate stats from API
- [ ] Run list displays all runs with correct status badges
- [ ] Run detail shows step progress and embedded trace
- [ ] Trace timeline shows events in chronological order with expandable details
- [ ] Review queue lists runs waiting for review
- [ ] Review panel shows LLM output and judge assessment side-by-side
- [ ] Approve/Edit/Reject actions work and update run status
- [ ] Sidebar shows correct pending review count
- [ ] Navigation between all pages works correctly
