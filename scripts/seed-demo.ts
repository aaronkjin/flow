import fs from "fs";
import path from "path";

const DATA_ROOT = path.join(process.cwd(), "data");
const DATASETS_DIR = path.join(DATA_ROOT, "datasets");
const WORKFLOWS_DIR = path.join(DATA_ROOT, "workflows");

fs.mkdirSync(DATASETS_DIR, { recursive: true });
fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });

const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";

async function fetchHFRows(
  dataset: string,
  offset: number,
  length: number,
  config = "default",
  split = "train"
): Promise<Record<string, unknown>[]> {
  const url = `${HF_ROWS_API}?dataset=${encodeURIComponent(dataset)}&config=${config}&split=${split}&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HuggingFace API error ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as {
    rows: Array<{ row_idx: number; row: Record<string, unknown> }>;
  };
  return body.rows.map((r) => r.row);
}

async function seedITTickets() {
  const filePath = path.join(DATASETS_DIR, "it-tickets.json");

  console.log("Fetching IT helpdesk tickets from HuggingFace...");
  const rows = await fetchHFRows(
    "Console-AI/IT-helpdesk-synthetic-tickets",
    0,
    50
  );

  const items = rows.map((row, i) => ({
    ticket_id: `TKT-${String(i + 1).padStart(3, "0")}`,
    subject: row.subject as string,
    description: row.description as string,
    category: row.category as string,
    priority: (row.priority as string).toLowerCase(),
    requester_email: row.requesterEmail as string,
    created_at: row.createdAt as string,
  }));

  const dataset = {
    config: {
      id: "it-tickets",
      name: "IT Helpdesk Tickets",
      description:
        "Real IT support tickets from Console-AI/IT-helpdesk-synthetic-tickets on HuggingFace",
      source: "huggingface:Console-AI/IT-helpdesk-synthetic-tickets",
      fields: [
        "ticket_id",
        "subject",
        "description",
        "category",
        "priority",
        "requester_email",
        "created_at",
      ],
      itemCount: items.length,
    },
    items,
  };

  fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
  console.log(`  ✓ Created ${filePath} (${items.length} items)`);
}

async function seedResumes() {
  const filePath = path.join(DATASETS_DIR, "resumes.json");

  console.log("Fetching resumes from HuggingFace...");
  const rows = await fetchHFRows(
    "AzharAli05/Resume-Screening-Dataset",
    0,
    50
  );

  const items = rows.map((row, i) => ({
    resume_id: `RES-${String(i + 1).padStart(3, "0")}`,
    role: row.Role as string,
    resume_text: row.Resume as string,
    decision: row.Decision as string,
    reason_for_decision: row.Reason_for_decision as string,
    job_description: row.Job_Description as string,
  }));

  const dataset = {
    config: {
      id: "resumes",
      name: "Resume Screening Dataset",
      description:
        "Real resume screening data from AzharAli05/Resume-Screening-Dataset on HuggingFace",
      source: "huggingface:AzharAli05/Resume-Screening-Dataset",
      fields: [
        "resume_id",
        "role",
        "resume_text",
        "decision",
        "reason_for_decision",
        "job_description",
      ],
      itemCount: items.length,
    },
    items,
  };

  fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
  console.log(`  ✓ Created ${filePath} (${items.length} items)`);
}

async function seedEmailClassification() {
  const filePath = path.join(DATASETS_DIR, "email-classification.json");

  console.log("Fetching email classification data from HuggingFace...");
  const rows = await fetchHFRows(
    "imnim/multiclass-email-classification",
    0,
    50
  );

  const items = rows.map((row, i) => ({
    email_id: `EML-${String(i + 1).padStart(3, "0")}`,
    subject: row.subject as string,
    body: row.body as string,
    labels: Array.isArray(row.labels)
      ? row.labels.filter((label): label is string => typeof label === "string")
      : [],
  }));

  const dataset = {
    config: {
      id: "email-classification",
      name: "Multiclass Email Classification Dataset",
      description:
        "Multi-label email samples from imnim/multiclass-email-classification on HuggingFace",
      source: "huggingface:imnim/multiclass-email-classification",
      fields: ["email_id", "subject", "body", "labels"],
      itemCount: items.length,
    },
    items,
  };

  fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
  console.log(`  ✓ Created ${filePath} (${items.length} items)`);
}

const IT_WORKFLOW_ID = "demo-it-ticket-triage";
const RESUME_WORKFLOW_ID = "demo-resume-screening";

function createITTicketTriageWorkflow() {
  const now = new Date().toISOString();

  const workflow = {
    id: IT_WORKFLOW_ID,
    name: "IT Ticket Triage",
    description:
      "Triages IT support tickets, drafts responses, and sends notifications",
    steps: [
      {
        id: "trigger-1",
        type: "trigger",
        name: "IT Tickets",
        config: {
          type: "trigger",
          triggerType: "dataset",
          datasetId: "it-tickets",
        },
        position: { x: 300, y: 0 },
      },
      {
        id: "llm-draft",
        type: "llm",
        name: "Draft Response",
        config: {
          type: "llm",
          model: "gpt-4o-mini",
          systemPrompt:
            "You are an experienced IT support specialist. Given a support ticket, draft a helpful, professional response that addresses the user's issue. Include specific troubleshooting steps when applicable. Be empathetic and clear.",
          userPrompt:
            "IT Support Ticket:\nSubject: {{input.subject}}\nCategory: {{input.category}}\nPriority: {{input.priority}}\n\nDescription:\n{{input.description}}\n\nPlease draft a response to this ticket.",
          temperature: 0.7,
          responseFormat: "text",
        },
        position: { x: 300, y: 150 },
      },
      {
        id: "judge-quality",
        type: "judge",
        name: "Quality Check",
        config: {
          type: "judge",
          inputStepId: "llm-draft",
          criteria: [
            {
              name: "accuracy",
              description:
                "Response correctly identifies and addresses the issue",
              weight: 0.3,
            },
            {
              name: "completeness",
              description:
                "Response includes all necessary troubleshooting steps",
              weight: 0.25,
            },
            {
              name: "tone",
              description:
                "Response is professional, empathetic, and clear",
              weight: 0.2,
            },
            {
              name: "actionability",
              description:
                "User can follow the steps to resolve their issue",
              weight: 0.25,
            },
          ],
          threshold: 0.8,
          model: "gpt-4o-mini",
        },
        position: { x: 300, y: 300 },
      },
      {
        id: "hitl-review",
        type: "hitl",
        name: "Review Response",
        config: {
          type: "hitl",
          instructions:
            "Review the drafted response for this IT support ticket. Check that the troubleshooting steps are correct and the tone is appropriate. Edit if needed.",
          showSteps: ["llm-draft", "judge-quality"],
          autoApproveOnJudgePass: false,
          judgeStepId: "judge-quality",
          reviewTargetStepId: "llm-draft",
        },
        position: { x: 300, y: 450 },
      },
      {
        id: "slack-notify",
        type: "connector",
        name: "Slack Notify",
        config: {
          type: "connector",
          connectorType: "slack",
          action: "send_message",
          params: {
            text: "✅ Ticket {{input.ticket_id}} ({{input.subject}}) — response approved and sent.",
          },
        },
        position: { x: 150, y: 600 },
      },
      {
        id: "email-response",
        type: "connector",
        name: "Send Email",
        config: {
          type: "connector",
          connectorType: "email",
          action: "send_email",
          params: {
            to: "{{input.requester_email}}",
            subject: "Re: {{input.subject}}",
            html: "<p>{{steps.llm-draft.result}}</p>",
          },
        },
        position: { x: 450, y: 600 },
      },
    ],
    edges: [
      { id: "e-trigger-llm", source: "trigger-1", target: "llm-draft" },
      { id: "e-llm-judge", source: "llm-draft", target: "judge-quality" },
      {
        id: "e-judge-hitl-pass",
        source: "judge-quality",
        target: "hitl-review",
        sourceHandle: "pass",
      },
      {
        id: "e-judge-hitl-flag",
        source: "judge-quality",
        target: "hitl-review",
        sourceHandle: "flag",
      },
      {
        id: "e-hitl-slack",
        source: "hitl-review",
        target: "slack-notify",
        sourceHandle: "approve",
      },
      {
        id: "e-hitl-email",
        source: "hitl-review",
        target: "email-response",
        sourceHandle: "approve",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const filePath = path.join(WORKFLOWS_DIR, `${IT_WORKFLOW_ID}.json`);
  fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
  console.log(`  ✓ Created workflow: ${workflow.name} (${filePath})`);
}

function createResumeScreeningWorkflow() {
  const now = new Date().toISOString();

  const workflow = {
    id: RESUME_WORKFLOW_ID,
    name: "Resume Screening",
    description:
      "Screens resumes, evaluates assessments, and logs decisions",
    steps: [
      {
        id: "trigger-1",
        type: "trigger",
        name: "Resumes",
        config: {
          type: "trigger",
          triggerType: "dataset",
          datasetId: "resumes",
        },
        position: { x: 300, y: 0 },
      },
      {
        id: "llm-screen",
        type: "llm",
        name: "Screen Resume",
        config: {
          type: "llm",
          model: "gpt-4o-mini",
          systemPrompt:
            "You are a resume screening assistant. Analyze resumes and return structured JSON assessments. Be objective and fair.",
          userPrompt:
            'Resume:\n{{input.resume_text}}\n\nRole Applied For: {{input.role}}\n\nJob Description:\n{{input.job_description}}\n\nAnalyze this resume and return JSON with exactly these fields:\n{\n  "qualifications": "Key qualifications, skills, education, and relevant experience (2-3 sentences)",\n  "fit_assessment": "How well the candidate fits the specified role (2-3 sentences)",\n  "recommendation": "strong_yes | yes | maybe | no",\n  "reasoning": "Brief explanation for the recommendation (1-2 sentences)"\n}',
          temperature: 0.5,
          responseFormat: "json",
        },
        position: { x: 300, y: 150 },
      },
      {
        id: "judge-screening",
        type: "judge",
        name: "Screening Quality",
        config: {
          type: "judge",
          inputStepId: "llm-screen",
          criteria: [
            {
              name: "accuracy",
              description:
                "Assessment accurately reflects the resume content",
              weight: 0.3,
            },
            {
              name: "completeness",
              description:
                "All relevant qualifications are identified",
              weight: 0.2,
            },
            {
              name: "fairness",
              description:
                "Assessment is objective and free from bias",
              weight: 0.3,
            },
            {
              name: "relevance",
              description:
                "Assessment correctly evaluates fit for the specified role",
              weight: 0.2,
            },
          ],
          threshold: 0.75,
          model: "gpt-4o-mini",
        },
        position: { x: 300, y: 300 },
      },
      {
        id: "hitl-review",
        type: "hitl",
        name: "Review Screening",
        config: {
          type: "hitl",
          instructions:
            "Review the resume screening assessment. Check that the qualifications extraction is accurate and the recommendation is fair. Edit if needed.",
          showSteps: ["llm-screen", "judge-screening"],
          autoApproveOnJudgePass: false,
          judgeStepId: "judge-screening",
          reviewTargetStepId: "llm-screen",
        },
        position: { x: 300, y: 450 },
      },
      {
        id: "sheets-log",
        type: "connector",
        name: "Log to Sheets",
        config: {
          type: "connector",
          connectorType: "google-sheets",
          action: "append_row",
          params: {
            spreadsheetId: "YOUR_SPREADSHEET_ID",
            range: "Sheet1!A:H",
            values: [
              "{{input.resume_id}}",
              "{{input.role}}",
              "{{input.decision}}",
              "{{input.reason_for_decision}}",
              "{{steps.llm-screen.result.qualifications}}",
              "{{steps.llm-screen.result.fit_assessment}}",
              "{{steps.llm-screen.result.recommendation}}",
              "{{steps.llm-screen.result.reasoning}}",
            ],
          },
        },
        position: { x: 150, y: 600 },
      },
      {
        id: "notion-record",
        type: "connector",
        name: "Create Record",
        config: {
          type: "connector",
          connectorType: "notion",
          action: "create_page",
          params: {
            databaseId: "YOUR_NOTION_DATABASE_ID",
            properties: {
              Name: "{{input.resume_id}} — {{input.role}}",
              Recommendation: "{{steps.llm-screen.result.recommendation}}",
              Qualifications: "{{steps.llm-screen.result.qualifications}}",
              Assessment: "{{steps.llm-screen.result.fit_assessment}}",
              Reasoning: "{{steps.llm-screen.result.reasoning}}",
            },
          },
        },
        position: { x: 450, y: 600 },
      },
    ],
    edges: [
      { id: "e-trigger-llm", source: "trigger-1", target: "llm-screen" },
      {
        id: "e-llm-judge",
        source: "llm-screen",
        target: "judge-screening",
      },
      {
        id: "e-judge-hitl-pass",
        source: "judge-screening",
        target: "hitl-review",
        sourceHandle: "pass",
      },
      {
        id: "e-judge-hitl-flag",
        source: "judge-screening",
        target: "hitl-review",
        sourceHandle: "flag",
      },
      {
        id: "e-hitl-sheets",
        source: "hitl-review",
        target: "sheets-log",
        sourceHandle: "approve",
      },
      {
        id: "e-hitl-notion",
        source: "hitl-review",
        target: "notion-record",
        sourceHandle: "approve",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const filePath = path.join(WORKFLOWS_DIR, `${RESUME_WORKFLOW_ID}.json`);
  fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
  console.log(`  ✓ Created workflow: ${workflow.name} (${filePath})`);
}

async function main() {
  console.log("🌱 Action Demo Seeder\n");

  console.log("--- Datasets ---");
  await seedITTickets();
  await seedResumes();
  await seedEmailClassification();

  console.log("\n--- Workflows ---");
  createITTicketTriageWorkflow();
  createResumeScreeningWorkflow();

  console.log("\n✅ Done! All demo data seeded.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
