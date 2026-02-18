# Work Trial Project

## Goal

Build a skateboard (see note on "skateboard" below) version of a platform that automates real-world knowledge work. Think of it as an agent builder combined with an execution engine.

## Behavioral Requirements

- Users can define and run automations
- Support for a small set of connectors and tools
  - Examples: API calls, integrations, storage, notifications, browser/computer use, filesystem tools)
- Tracing, so you can see what happened and why
- Support for human-in-the-loop interactions (approval/reject, edit)

## Implementation Guidelines

- Focus on whatever you think is most important, or is most interesting to you
  - Examples: the agent harness itself, human-in-the-loop ergonomics, the agent building UX, core abstractions, or something else (be creative)
- Any framework, library, tooling, infra, etc. is fair game
- Be creative

## Deliverables

- A runnable repo with a short README (what you built and how to run it)
- A ~15-minute presentation covering:
  1. A demo of what you built
  2. Why you made the decisions you did
  3. What you would do differently and next steps

## EXAMPLE ENTERPRISE TASKS

Below are example automations a user might build. Use these as inspiration, not strict requirements.

### Example 1: Ticket → draft email → HITL approve/edit → send via Resend

Dataset: Sample IT support tickets dataset here (https://huggingface.co/datasets/Console-AI/IT-helpdesk-synthetic-tickets).

- Input: One ticket (replayed from CSV/JSONL or via webhook).
- Steps:
  1. Draft email (using LLM or templates) to the requester based on an SOP:
     - Short acknowledgment
     - 2–5 troubleshooting steps tailored to the category
     - Clear next action or questions needed
  2. HITL: Route the draft to a human-in-the-loop step where an operator can approve or edit.
  3. Send the approved email via Resend (or your preferred tool).

### Example 2: Invoice PDF → extract key fields → write results to table

Dataset: Sample invoice PDFs dataset here (https://huggingface.co/datasets/parsee-ai/invoices-example).
Input: Invoice PDF (possibly triggered by email attachment)
Steps:

1. Extract relevant information from the invoice (e.g., vendor name, invoice number, invoice date, PO number if applicable, currency, subtotal, tax/VAT, shipping, total, payment terms, and due date).
   - Optionally include validation or duplication checks.
2. HITL: Route the extracted result to a human-in-the-loop step where an operator can approve or edit (optionally only when confidence is low).
3. Write-back: Store the approved result in a table (e.g., Airtable or Sheets).

Optional:

- If using a dataset with ground-truth answers, compute a basic score across batch replays (e.g., exact match or normalized match).

## What is the "Skateboard Mindset"?

### Definition

The skateboard mindset is a default way of building: for every product idea, feature, or epic, identify the smallest end-to-end experience (“the skateboard”) that:

1. delivers the _core user value_ (even in a crude form), and
2. tests the _riskiest assumption_ as fast as possible,
   while staying aligned with the long-term “North Star” vision.

An MVP is not a one-time launch artifact. The skateboard is a repeating discipline applied continuously throughout development.

---

### Operating Principles (the rules you must follow)

1. Start with the outcome, not the implementation.
   - Define: who is the user, what job are they trying to do, what “success” looks like, and what failure would look like.

2. Identify the single riskiest assumption.
   - Examples: “Users will trust an agent to do X,” “Connector Y is essential,” “HITL step is required,” “Trace UX will be used,” “The task is automatable at all.”

3. Build the smallest _end-to-end_ loop that tests that assumption.
   - End-to-end means: trigger → execute → observable output → (optional) HITL → final side effect / stored result → trace.
   - Prefer a narrow vertical slice over a broad partial platform.

4. Prefer simulation over construction when it accelerates learning.
   - It is acceptable (often preferred) to “fake” parts:
     - manual / scripted steps (“Wizard-of-Oz”)
     - stubbed connectors
     - hardcoded policies
     - mocked data stores
   - Constraint: the user experience and trace must reflect what would happen in reality (no misleading results).

5. Ruthlessly remove scope that does not affect the learning goal.
   - If a component does not change whether the hypothesis passes/fails, cut it.

6. Instrument first: make learning visible.
   - Always produce artifacts that explain what happened:
     - structured trace events
     - inputs/outputs per step
     - tool calls + results
     - errors + retries
     - human decisions (approve/edit/reject) and deltas

7. Timebox decisions; optimize for iteration speed.
   - Choose the fastest path that is “good enough” to validate the core.
   - Defer generality, scale, polish, and completeness until the core is proven.

8. Keep a North Star, but do not prescribe the final solution.
   - Maintain a clear direction (what the eventual platform should enable).
   - Treat the skateboard as a step toward that direction, not the destination.

---

### The Skateboard Checklist (use this before building anything)

- Core user job:
  - “User wants to \_**\_ so that \_\_**.”
- Core value delivered:
  - “If this works, the user gets \_\_\_\_.”
- Riskiest assumption:
  - “This fails if \_\_\_\_ is not true.”
- Minimal end-to-end test:
  - “We can test this by building \_\_\_\_ (single thin slice).”
- What to fake:
  - “We will simulate \_**\_ via \_\_**.”
- What to measure / observe:
  - “We will know it worked if \_\_\_\_.”
- Exit criteria:
  - “If \_**\_ happens, we iterate; if \_\_** happens, we pivot/stop.”

---

### Anti-Patterns (avoid)

- Building “platform scaffolding” with no runnable workflow.
- Adding multiple connectors/tools before one full automation works.
- Perfecting UX, schemas, abstractions, or infra before validating the core loop.
- Confusing “minimal” with “low quality”; the goal is minimal scope, not broken behavior.
- Lack of traceability: if you can’t explain what happened, you can’t learn.

---

### Application to this project (what “skateboard” means here)

Your skateboard must demonstrate at least one real automation running end-to-end with:

- a defined workflow (steps + tools)
- a connector/tool (can be stubbed if necessary)
- tracing that explains each step
- a human-in-the-loop gate (approve/edit/reject) OR a clear reason it’s omitted for the skateboard
- a final side effect (send/store/write) OR a simulated equivalent with auditable logs

Prefer one compelling enterprise workflow that fully runs over a partial “agent builder platform.”
