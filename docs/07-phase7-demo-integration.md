# Phase 7: Demo Integration (~2 hours)

## Goal

Build the dataset loader, create two demo workflows (IT ticket triage + resume screening), and test the full end-to-end loop.

## Tasks

### 7.1 Dataset Loader (30 min)

**File**: `src/lib/datasets/loader.ts`

- Download sample data from HuggingFace datasets (pre-download, store in `data/datasets/`)
- `DatasetLoader` class:
  - `getAvailableDatasets(): DatasetConfig[]` — lists demo datasets
  - `getDatasetItems(datasetId, limit, offset): any[]` — returns items
  - `getDatasetItem(datasetId, index): any` — returns single item

**Demo Dataset 1: IT Helpdesk Tickets**
- Source: `Console-AI/IT-helpdesk-synthetic-tickets` (HuggingFace, MIT)
- Fields: ticket_id, subject, description, category, priority
- Pre-download 50 sample records to `data/datasets/it-tickets.json`

**Demo Dataset 2: Resumes**
- Source: `AzharAli05/Resume-Screening-Dataset` (HuggingFace, MIT)
- Fields: resume_text, category
- Pre-download 50 sample records to `data/datasets/resumes.json`

### 7.2 IT Ticket Triage Workflow (30 min)

Build via the visual editor (proving the canvas works):

**Canvas layout** (top to bottom):
```
  [Trigger: IT Tickets Dataset]
            ↓
  [LLM: Draft Response]
    System: "You are an IT support specialist..."
    User: "Ticket: {{input.subject}}\n{{input.description}}\nDraft a helpful response."
            ↓
  [Judge: Evaluate Response Quality]
    Criteria: accuracy, completeness, tone, actionability
    Threshold: 0.8
            ↓
  [HITL: Review Draft Response]
    Instructions: "Review the drafted response for this IT ticket."
            ↓
    ┌───────┴───────┐
    ↓               ↓
  [Slack:        [Email:
   Notify]        Send Response]
```

- Save this workflow via the editor
- Test with a single ticket from the dataset
- Verify full flow: LLM drafts → Judge evaluates → HITL pauses → Approve → Slack fires + Email sends

### 7.3 Resume Screening Workflow (30 min)

Build via the visual editor:

**Canvas layout**:
```
  [Trigger: Resume Dataset]
            ↓
  [LLM: Extract & Screen]
    System: "You are a resume screening assistant..."
    User: "Resume:\n{{input.resume_text}}\n\nExtract qualifications and assess fit."
            ↓
  [Judge: Evaluate Screening Accuracy]
    Criteria: accuracy, completeness, fairness, relevance
    Threshold: 0.75
            ↓
  [HITL: Review Screening]
    Instructions: "Review the resume screening assessment."
            ↓
    ┌───────┴───────┐
    ↓               ↓
  [Google Sheets:  [Notion:
   Log Decision]    Create Record]
```

- Save and test with a single resume
- Verify full flow end-to-end

### 7.4 Integration Testing (30 min)

Full loop verification:

1. **Build → Save → Reopen**: Create workflow on canvas, save, close, reopen — canvas state preserved
2. **Run single item**: Select one dataset item, run, watch progress via polling
3. **HITL pause/resume**: Verify run pauses, review queue shows it, approve continues it
4. **Connector fires**: Verify real Slack message, real email, real Sheets row (with env vars set)
5. **Trace complete**: Open completed run, verify trace has all events with timing
6. **Batch run** (stretch): Run with 5 items from dataset, verify all 5 produce traces
7. **Error handling**: Test with missing API key — verify graceful error in trace

## Verification

- [ ] Dataset loader returns sample IT tickets and resumes
- [ ] IT ticket triage workflow builds correctly on canvas
- [ ] Resume screening workflow builds correctly on canvas
- [ ] Both workflows save and reload with correct canvas state
- [ ] Single-item run completes full loop (LLM → Judge → HITL → Connectors)
- [ ] Real connectors fire (Slack message sent, email sent, Sheets row appended)
- [ ] Trace viewer shows complete timeline for each run
- [ ] HITL review flow works (pause → review → approve → continue)
- [ ] Both workflows use the same engine (proving generalizability)
