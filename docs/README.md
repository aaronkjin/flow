# Documentation Hub

This folder is the control center for Action. Every subagent should start here, then open the file(s) tied to their assignment.

## File Map

| File                            | Purpose                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTRUCTIONS.md`               | Original work-trial brief: behavioral requirements, skateboard mindset definition, example enterprise tasks, anti-patterns. Read this first. |
| `CLAUDE.md`                     | Master briefing: mission, repo layout, guardrails, data contracts, env vars, testing commands, Phase 1 implementation notes.                 |
| `SPEC.md`                       | Delegation-ready specs derived from the project plan, including sequencing + parallelization hints.                                          |
| `PLAN.md`                       | Original roadmap with timeline estimates and architecture summary. Use alongside SPEC for deeper context.                                    |
| `00-overview.md`                | High-level product overview, user flow, architecture, stack, design decisions.                                                               |
| `01-phase1-foundation.md`       | Phase 1 tasks (scaffold, types, persistence, interpolation, engine).                                                                         |
| `02-phase2-step-executors.md`   | Phase 2 tasks for LLM/Judge/HITL/Connector executors.                                                                                        |
| `03-phase3-connectors.md`       | Real connector implementations + env var references.                                                                                         |
| `04-phase4-api-routes.md`       | API surface contract for workflows, runs, review, traces, datasets.                                                                          |
| `05-phase5-visual-editor.md`    | Detailed spec for the React Flow builder.                                                                                                    |
| `06-phase6-ui-pages.md`         | Dashboard, runs, trace, review UI specs.                                                                                                     |
| `07-phase7-demo-integration.md` | Dataset loader + sample workflows + integration checklist.                                                                                   |
| `08-phase8-polish.md`           | Final polish, README requirements, error handling sweep.                                                                                     |

## How to Use These Docs

1. **New contributor onboarding:** Read `CLAUDE.md` → `SPEC.md` → `PLAN.md` → relevant phase doc.
2. **Task delegation:** Assign the task ID from `SPEC.md` (e.g., "Phase 1 — Task 1.4"). The assignee should cross-reference the matching phase file for step-by-step guidance.
3. **Status tracking:** When you finish a task, update any impacted docs (e.g., mark verification checklist, note new rules in `CLAUDE.md`).
4. **Doc hygiene:** Do not rename or delete files. If you add new specs, link them in this README so other agents can discover them.

Keeping the documentation synchronized is part of the delivery. If information diverges, update the doc immediately before switching tasks.
