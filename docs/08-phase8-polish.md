# Phase 8: Polish + README (~1 hour)

## Goal

Handle edge cases, write documentation, and prepare for demo.

## Tasks

### 8.1 Error Handling + Edge Cases (20 min)

- **Missing API keys**: Show clear setup instructions instead of cryptic errors
- **Empty canvas**: Prevent running workflow with no steps
- **Invalid connections**: Prevent connecting incompatible handles (e.g., two inputs)
- **Stale runs**: Startup reconciliation marks stuck "running" runs as failed
- **Network errors**: API route error boundaries with retry hints
- **LLM timeouts**: 30s timeout on OpenAI calls with retry logic
- **Large datasets**: Pagination for dataset loading (limit/offset)
- **Concurrent edits**: Last-write-wins (acceptable for demo scale)

### 8.2 README (25 min)

**File**: `README.md`

Sections:

1. **Overview**: What Action is, screenshot/GIF of the visual editor
2. **Quick Start**:
   - `npm install` + `npm run dev`
   - Set up `.env.local` with API keys
   - Open `http://localhost:3000`
3. **Architecture**: Brief diagram, tech stack, key design decisions
4. **Visual Editor Guide**: How to drag blocks, connect them, configure
5. **Demo Walkthrough**:
   - IT Ticket Triage: step-by-step with screenshots
   - Resume Screening: step-by-step
6. **Connector Setup**: How to get API keys for each connector
7. **Environment Variables**: Full list with descriptions
8. **Project Structure**: Directory tree with file purposes

### 8.3 Final Cleanup (15 min)

- Remove unused imports and dead code
- Ensure consistent code formatting
- Verify all pages load without console errors
- Check mobile responsiveness (basic)
- Verify .gitignore covers data/ directory
- Final smoke test of all features

## Environment Variables Reference

```env
# Required
OPENAI_API_KEY=sk-...                              # OpenAI API key for LLM steps

# Optional — connectors work only when configured
SLACK_WEBHOOK_URL=https://hooks.slack.com/...       # Slack Incoming Webhook
RESEND_API_KEY=re_...                               # Resend email API key
NOTION_API_KEY=ntn_...                              # Notion Internal Integration
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_..."}  # Google Cloud service account
```

## Verification (Final)

- [ ] Fresh clone → `npm install` → `npm run dev` → app loads
- [ ] Create workflow from scratch using visual editor
- [ ] Run workflow with dataset item → completes or pauses at HITL
- [ ] Review and approve HITL → workflow continues to completion
- [ ] Trace viewer shows complete execution timeline
- [ ] All configured connectors fire successfully
- [ ] README provides clear setup and walkthrough instructions
