# Phase 3: Real Connectors (~2.5 hours)

## Goal

Build 5 real connectors (not stubs) that fire real actions via API keys and webhook URLs. Zero OAuth complexity.

## Tasks

### 3.1 Connector Interface + Registry (15 min)

**File**: `src/lib/connectors/registry.ts`

```typescript
interface Connector {
  type: string;
  execute(action: string, params: Record<string, unknown>): Promise<ConnectorResult>;
}

// Registry: Map<string, Connector>
// registerConnector(connector: Connector): void
// getConnector(type: string): Connector | undefined
// All connectors auto-register on import
```

### 3.2 Slack Connector (15 min)

**File**: `src/lib/connectors/slack.ts`

- Auth: Incoming Webhook URL (env: `SLACK_WEBHOOK_URL` or per-step config)
- Action `send_message`:
  - Params: `{ webhookUrl?, text, channel?, username?, icon_emoji? }`
  - `POST` webhook URL with JSON `{ text, channel, username, icon_emoji }`
- Simple fetch call, no SDK needed

### 3.3 HTTP/Webhook Connector (20 min)

**File**: `src/lib/connectors/http.ts`

- Generic HTTP connector for arbitrary webhooks/APIs
- Action `request`:
  - Params: `{ url, method, headers?, body?, authType?, authToken? }`
  - `authType`: "none" | "bearer" | "api-key"
  - Builds headers based on auth type
  - Executes fetch, returns response body
- Flexible enough to integrate with any API that accepts HTTP calls

### 3.4 Email Connector — Resend (20 min)

**File**: `src/lib/connectors/email.ts`

- Auth: Resend API key (env: `RESEND_API_KEY`)
- Action `send_email`:
  - Params: `{ to, subject, html, from?, replyTo? }`
  - `POST https://api.resend.com/emails` with JSON body
  - From defaults to `onboarding@resend.dev` (Resend's default domain)
- Uses fetch directly (no SDK needed, Resend API is simple)

### 3.5 Notion Connector (30 min)

**File**: `src/lib/connectors/notion.ts`

- Auth: Internal Integration Token (env: `NOTION_API_KEY`)
- Install: `@notionhq/client`
- Action `create_page`:
  - Params: `{ databaseId, properties }`
  - Properties map field names to values with types
  - Creates a new page/row in a Notion database
- Action `update_page`:
  - Params: `{ pageId, properties }`
  - Updates existing page properties

### 3.6 Google Sheets Connector (45 min)

**File**: `src/lib/connectors/google-sheets.ts`

- Auth: Service Account JSON (env: `GOOGLE_SERVICE_ACCOUNT_JSON`)
- Install: `googleapis`
- Action `append_row`:
  - Params: `{ spreadsheetId, range, values }`
  - Uses Sheets API v4 `spreadsheets.values.append`
  - Appends a row of values to the specified range
- Action `read_range`:
  - Params: `{ spreadsheetId, range }`
  - Returns cell values from range
- JWT auth from service account credentials

## Config Panel Fields (per connector type)

| Connector | Config Fields |
|-----------|--------------|
| Slack | Webhook URL |
| HTTP | URL, Method, Headers, Body template, Auth type, Auth token |
| Email | To address, Subject, HTML body template, From, Reply-To |
| Notion | Database ID, Property mappings |
| Google Sheets | Spreadsheet ID, Sheet name, Column mappings |

## Environment Variables

```env
# Optional — connectors degrade gracefully if not set
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
RESEND_API_KEY=re_...
NOTION_API_KEY=ntn_...
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

## Verification

- [ ] Slack connector sends a real message to a webhook URL
- [ ] HTTP connector makes a real request to httpbin.org
- [ ] Email connector sends a real email via Resend
- [ ] Notion connector creates a page in a test database
- [ ] Google Sheets connector appends a row to a test spreadsheet
- [ ] Missing API keys produce clear error messages (not crashes)
- [ ] Connector registry correctly resolves all 5 types
