"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Plus, Trash2, PanelRight } from "lucide-react";
import type { UseWorkflowReturn, WorkflowNodeData } from "./hooks/use-workflow";
import type {
  TriggerStepConfig,
  LLMStepConfig,
  JudgeStepConfig,
  JudgeCriterion,
  HITLStepConfig,
  ConnectorStepConfig,
  ConditionStepConfig,
  AgentStepConfig,
  AgentToolRef,
  SubWorkflowStepConfig,
  WorkflowBlockField,
  StepConfig,
  ConnectorType,
} from "@/lib/engine/types";
import type { Node } from "@xyflow/react";

interface ConfigPanelProps {
  workflow: UseWorkflowReturn;
  onCollapse?: () => void;
  className?: string;
  hideHeader?: boolean;
}

const fieldClass =
  "bg-muted/50 border-transparent focus-visible:border-ring focus-visible:bg-background transition-colors";

function getPriorNodes(
  nodes: Node<WorkflowNodeData>[],
  currentId: string,
): Node<WorkflowNodeData>[] {
  return nodes.filter((n) => n.id !== currentId);
}

function getNodesByType(
  nodes: Node<WorkflowNodeData>[],
  type: string,
  currentId: string,
): Node<WorkflowNodeData>[] {
  return nodes.filter((n) => n.data.stepType === type && n.id !== currentId);
}

function TriggerForm({
  config,
  onUpdate,
}: {
  config: TriggerStepConfig;
  onUpdate: (c: StepConfig) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Trigger Type</Label>
        <Select
          value={config.triggerType}
          onValueChange={(v) =>
            onUpdate({
              ...config,
              triggerType: v as TriggerStepConfig["triggerType"],
            })
          }
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="dataset">Dataset</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.triggerType === "dataset" && (
        <div className="space-y-2">
          <Label className="text-xs font-heading">Dataset ID</Label>
          <Input
            className={fieldClass}
            value={config.datasetId ?? ""}
            onChange={(e) => onUpdate({ ...config, datasetId: e.target.value })}
            placeholder="e.g. tickets-sample"
          />
        </div>
      )}
    </div>
  );
}

function LLMForm({
  config,
  onUpdate,
}: {
  config: LLMStepConfig;
  onUpdate: (c: StepConfig) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Model</Label>
        <Select
          value={config.model}
          onValueChange={(v) => onUpdate({ ...config, model: v })}
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
            <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
            <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
            <SelectItem value="gpt-5.2">gpt-5.2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">System Prompt</Label>
        <Textarea
          className={fieldClass}
          rows={6}
          value={config.systemPrompt}
          onChange={(e) =>
            onUpdate({ ...config, systemPrompt: e.target.value })
          }
          placeholder="You are a helpful assistant..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">User Prompt</Label>
        <Textarea
          className={fieldClass}
          rows={6}
          value={config.userPrompt}
          onChange={(e) => onUpdate({ ...config, userPrompt: e.target.value })}
          placeholder="Use {{input.field}} or {{steps.stepId.field}} for interpolation"
        />
        <p className="text-xs text-muted-foreground/60">
          {"Supports {{input.field}} and {{steps.stepId.field}} interpolation"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-heading">Temperature</Label>
          <span className="text-xs text-muted-foreground/60">
            {config.temperature}
          </span>
        </div>
        <Slider
          value={[config.temperature]}
          min={0}
          max={2}
          step={0.1}
          onValueChange={([v]) => onUpdate({ ...config, temperature: v })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">Response Format</Label>
        <Select
          value={config.responseFormat}
          onValueChange={(v) =>
            onUpdate({
              ...config,
              responseFormat: v as LLMStepConfig["responseFormat"],
            })
          }
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function JudgeForm({
  config,
  onUpdate,
  nodes,
  currentId,
}: {
  config: JudgeStepConfig;
  onUpdate: (c: StepConfig) => void;
  nodes: Node<WorkflowNodeData>[];
  currentId: string;
}) {
  const priorNodes = getPriorNodes(nodes, currentId);

  function updateCriterion(index: number, updates: Partial<JudgeCriterion>) {
    const criteria = config.criteria.map((c, i) =>
      i === index ? { ...c, ...updates } : c,
    );
    onUpdate({ ...config, criteria });
  }

  function addCriterion() {
    onUpdate({
      ...config,
      criteria: [
        ...config.criteria,
        { name: "", description: "", weight: 0.5 },
      ],
    });
  }

  function removeCriterion(index: number) {
    onUpdate({
      ...config,
      criteria: config.criteria.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Input Step</Label>
        <Select
          value={config.inputStepId}
          onValueChange={(v) => onUpdate({ ...config, inputStepId: v })}
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue placeholder="Select step..." />
          </SelectTrigger>
          <SelectContent>
            {priorNodes.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.data.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-heading">Threshold</Label>
          <span className="text-xs text-muted-foreground/60">
            {config.threshold}
          </span>
        </div>
        <Slider
          value={[config.threshold]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => onUpdate({ ...config, threshold: v })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">Model</Label>
        <Select
          value={config.model}
          onValueChange={(v) => onUpdate({ ...config, model: v })}
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
            <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
            <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
            <SelectItem value="gpt-5.2">gpt-5.2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-heading">Criteria</Label>
          <Button variant="ghost" size="sm" onClick={addCriterion}>
            <Plus className="size-3 mr-1" /> Add
          </Button>
        </div>
        {config.criteria.map((criterion, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-border/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground/60">
                Criterion {i + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCriterion(i)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <Input
              className={fieldClass}
              value={criterion.name}
              onChange={(e) => updateCriterion(i, { name: e.target.value })}
              placeholder="Name"
            />
            <Input
              className={fieldClass}
              value={criterion.description}
              onChange={(e) =>
                updateCriterion(i, { description: e.target.value })
              }
              placeholder="Description"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs font-heading shrink-0">Weight</Label>
              <Slider
                value={[criterion.weight]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => updateCriterion(i, { weight: v })}
              />
              <span className="text-xs text-muted-foreground/60 w-8 text-right">
                {criterion.weight}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HITLForm({
  config,
  onUpdate,
  nodes,
  currentId,
}: {
  config: HITLStepConfig;
  onUpdate: (c: StepConfig) => void;
  nodes: Node<WorkflowNodeData>[];
  currentId: string;
}) {
  const priorNodes = getPriorNodes(nodes, currentId);
  const judgeNodes = getNodesByType(nodes, "judge", currentId);

  function toggleShowStep(stepId: string, checked: boolean) {
    const showSteps = checked
      ? [...config.showSteps, stepId]
      : config.showSteps.filter((s) => s !== stepId);
    onUpdate({ ...config, showSteps });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Instructions</Label>
        <Textarea
          className={fieldClass}
          rows={4}
          value={config.instructions}
          onChange={(e) =>
            onUpdate({ ...config, instructions: e.target.value })
          }
          placeholder="Instructions for the reviewer..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">Steps to Show</Label>
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          {priorNodes.length === 0 && (
            <p className="text-xs text-muted-foreground/60">No prior steps</p>
          )}
          {priorNodes.map((n) => (
            <div key={n.id} className="flex items-center justify-between">
              <span className="text-sm">{n.data.label}</span>
              <Switch
                checked={config.showSteps.includes(n.id)}
                onCheckedChange={(checked) =>
                  toggleShowStep(n.id, checked === true)
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-heading">Auto-approve on Judge Pass</Label>
        <Switch
          checked={config.autoApproveOnJudgePass}
          onCheckedChange={(checked) =>
            onUpdate({
              ...config,
              autoApproveOnJudgePass: checked === true,
            })
          }
        />
      </div>

      {config.autoApproveOnJudgePass && (
        <div className="space-y-2">
          <Label className="text-xs font-heading">Judge Step</Label>
          <Select
            value={config.judgeStepId ?? ""}
            onValueChange={(v) =>
              onUpdate({ ...config, judgeStepId: v || undefined })
            }
          >
            <SelectTrigger className={`w-full ${fieldClass}`}>
              <SelectValue placeholder="Select judge step..." />
            </SelectTrigger>
            <SelectContent>
              {judgeNodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.data.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-heading">Review Target Step</Label>
        <Select
          value={config.reviewTargetStepId ?? ""}
          onValueChange={(v) =>
            onUpdate({ ...config, reviewTargetStepId: v || undefined })
          }
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue placeholder="Select target step..." />
          </SelectTrigger>
          <SelectContent>
            {priorNodes.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.data.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

const connectorActions: Record<
  ConnectorType,
  { value: string; label: string }[]
> = {
  slack: [{ value: "send_message", label: "Send Message" }],
  email: [{ value: "send_email", label: "Send Email" }],
  http: [{ value: "request", label: "HTTP Request" }],
  notion: [
    { value: "create_page", label: "Create Page" },
    { value: "update_page", label: "Update Page" },
  ],
  "google-sheets": [
    { value: "append_row", label: "Append Row" },
    { value: "read_range", label: "Read Range" },
  ],
};

function ConnectorForm({
  config,
  onUpdate,
}: {
  config: ConnectorStepConfig;
  onUpdate: (c: StepConfig) => void;
}) {
  const params = (config.params ?? {}) as Record<string, string>;

  function setParam(key: string, value: string) {
    onUpdate({ ...config, params: { ...config.params, [key]: value } });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Connector Type</Label>
        <Select
          value={config.connectorType}
          onValueChange={(v) =>
            onUpdate({
              ...config,
              connectorType: v as ConnectorType,
              action: connectorActions[v as ConnectorType]?.[0]?.value ?? "",
              params: {},
            })
          }
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="http">HTTP</SelectItem>
            <SelectItem value="notion">Notion</SelectItem>
            <SelectItem value="google-sheets">Google Sheets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">Action</Label>
        <Select
          value={config.action}
          onValueChange={(v) => onUpdate({ ...config, action: v })}
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(connectorActions[config.connectorType] ?? []).map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {config.connectorType === "slack" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-heading">Message Text</Label>
            <Textarea
              className={fieldClass}
              rows={4}
              value={params.text ?? ""}
              onChange={(e) => setParam("text", e.target.value)}
              placeholder="Hello from Flow! Supports {{interpolation}}"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-heading">Webhook URL</Label>
            <Input
              className={fieldClass}
              value={params.webhookUrl ?? ""}
              onChange={(e) => setParam("webhookUrl", e.target.value)}
              placeholder="Leave empty to use SLACK_WEBHOOK_URL env"
            />
          </div>
        </div>
      )}

      {config.connectorType === "email" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-heading">To</Label>
            <Input
              className={fieldClass}
              value={params.to ?? ""}
              onChange={(e) => setParam("to", e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-heading">Subject</Label>
            <Input
              className={fieldClass}
              value={params.subject ?? ""}
              onChange={(e) => setParam("subject", e.target.value)}
              placeholder="Email subject — supports {{interpolation}}"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-heading">HTML Body</Label>
            <Textarea
              className={fieldClass}
              rows={4}
              value={params.html ?? ""}
              onChange={(e) => setParam("html", e.target.value)}
              placeholder="<p>Hello {{input.name}}</p>"
            />
          </div>
        </div>
      )}

      {config.connectorType === "http" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-heading">URL</Label>
            <Input
              className={fieldClass}
              value={params.url ?? ""}
              onChange={(e) => setParam("url", e.target.value)}
              placeholder="https://api.example.com/webhook"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-heading">Method</Label>
            <Select
              value={(params.method as string) ?? "POST"}
              onValueChange={(v) => setParam("method", v)}
            >
              <SelectTrigger className={`w-full ${fieldClass}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-heading">Body</Label>
            <Textarea
              className={fieldClass}
              rows={4}
              value={params.body ?? ""}
              onChange={(e) => setParam("body", e.target.value)}
              placeholder='{"key": "{{steps.llm.result}}"}'
            />
          </div>
        </div>
      )}

      {config.connectorType === "notion" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-heading">Database ID</Label>
            <Input
              className={fieldClass}
              value={params.databaseId ?? ""}
              onChange={(e) => setParam("databaseId", e.target.value)}
              placeholder="Notion database ID"
            />
          </div>
        </div>
      )}

      {config.connectorType === "google-sheets" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-heading">Spreadsheet ID</Label>
            <Input
              className={fieldClass}
              value={params.spreadsheetId ?? ""}
              onChange={(e) => setParam("spreadsheetId", e.target.value)}
              placeholder="Google Sheets spreadsheet ID"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-heading">Range</Label>
            <Input
              className={fieldClass}
              value={params.range ?? ""}
              onChange={(e) => setParam("range", e.target.value)}
              placeholder="Sheet1!A:E"
            />
          </div>
          <p className="text-xs text-muted-foreground/60">
            {
              "For append_row, set values in additional params. Supports {{interpolation}}."
            }
          </p>
        </div>
      )}
    </div>
  );
}

function ConditionForm({
  config,
  onUpdate,
}: {
  config: ConditionStepConfig;
  onUpdate: (c: StepConfig) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Expression</Label>
        <Input
          className={fieldClass}
          value={config.expression}
          onChange={(e) => onUpdate({ ...config, expression: e.target.value })}
          placeholder='{{steps.judge.recommendation}} === "pass"'
        />
        <p className="text-xs text-muted-foreground/60">
          {"Supports {{interpolation}} and comparison operators"}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">Yes Label</Label>
        <Input
          className={fieldClass}
          value={config.yesLabel ?? "yes"}
          onChange={(e) => onUpdate({ ...config, yesLabel: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">No Label</Label>
        <Input
          className={fieldClass}
          value={config.noLabel ?? "no"}
          onChange={(e) => onUpdate({ ...config, noLabel: e.target.value })}
        />
      </div>
    </div>
  );
}

function AgentForm({
  config,
  onUpdate,
}: {
  config: AgentStepConfig;
  onUpdate: (updates: Partial<AgentStepConfig>) => void;
}) {
  const tools = config.tools ?? [];

  function updateTool(index: number, updates: Partial<AgentToolRef>) {
    const newTools = tools.map((t, i) =>
      i === index ? { ...t, ...updates } : t
    );
    onUpdate({ tools: newTools });
  }

  function addTool() {
    onUpdate({
      tools: [
        ...tools,
        { type: "connector", connectorType: "slack", action: "send_message" },
      ],
    });
  }

  function removeTool(index: number) {
    onUpdate({ tools: tools.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Model</Label>
        <Select
          value={config.model}
          onValueChange={(v) => onUpdate({ model: v })}
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
            <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
            <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
            <SelectItem value="gpt-5.2">gpt-5.2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">System Prompt</Label>
        <Textarea
          className={fieldClass}
          rows={4}
          value={config.systemPrompt}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          placeholder="You are a helpful agent..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-heading">Task Prompt</Label>
        <Textarea
          className={fieldClass}
          rows={4}
          value={config.taskPrompt}
          onChange={(e) => onUpdate({ taskPrompt: e.target.value })}
          placeholder="Use {{input.field}} or {{steps.stepId.field}} for interpolation"
        />
        <p className="text-xs text-muted-foreground/60">
          {"Supports {{input.field}} and {{steps.stepId.field}} interpolation"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-heading">Temperature</Label>
          <span className="text-xs text-muted-foreground/60">
            {config.temperature}
          </span>
        </div>
        <Slider
          value={[config.temperature]}
          min={0}
          max={2}
          step={0.1}
          onValueChange={([v]) => onUpdate({ temperature: v })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-heading">Max Iterations</Label>
          <span className="text-xs text-muted-foreground/60">
            {config.maxIterations}
          </span>
        </div>
        <Slider
          value={[config.maxIterations]}
          min={1}
          max={30}
          step={1}
          onValueChange={([v]) => onUpdate({ maxIterations: v })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-heading">Tools</Label>
          <Button variant="ghost" size="sm" onClick={addTool}>
            <Plus className="size-3 mr-1" /> Add
          </Button>
        </div>
        {tools.map((tool, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-border/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground/60">
                Tool {i + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTool(i)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <Select
              value={tool.type}
              onValueChange={(v) =>
                updateTool(i, {
                  type: v as AgentToolRef["type"],
                  ...(v === "connector"
                    ? { connectorType: "slack", action: "send_message" }
                    : {}),
                  ...(v === "custom_function"
                    ? { functionName: "", functionDescription: "" }
                    : {}),
                })
              }
            >
              <SelectTrigger className={`w-full ${fieldClass}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="connector">Connector</SelectItem>
                <SelectItem value="custom_function">Custom Function</SelectItem>
              </SelectContent>
            </Select>

            {tool.type === "connector" && (
              <>
                <Select
                  value={tool.connectorType ?? "slack"}
                  onValueChange={(v) =>
                    updateTool(i, { connectorType: v as ConnectorType })
                  }
                >
                  <SelectTrigger className={`w-full ${fieldClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="notion">Notion</SelectItem>
                    <SelectItem value="google-sheets">Google Sheets</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className={fieldClass}
                  value={tool.action ?? ""}
                  onChange={(e) => updateTool(i, { action: e.target.value })}
                  placeholder="Action (e.g. send_message)"
                />
              </>
            )}

            {tool.type === "custom_function" && (
              <>
                <Input
                  className={fieldClass}
                  value={tool.functionName ?? ""}
                  onChange={(e) =>
                    updateTool(i, { functionName: e.target.value })
                  }
                  placeholder="Function name"
                />
                <Input
                  className={fieldClass}
                  value={tool.functionDescription ?? ""}
                  onChange={(e) =>
                    updateTool(i, { functionDescription: e.target.value })
                  }
                  placeholder="Description"
                />
                <Textarea
                  className={`${fieldClass} font-mono text-xs`}
                  rows={3}
                  value={
                    tool.functionParameters
                      ? JSON.stringify(tool.functionParameters, null, 2)
                      : ""
                  }
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateTool(i, { functionParameters: parsed });
                    } catch (err) {
                      void err;
                    }
                  }}
                  placeholder='{"type": "object", "properties": {...}}'
                />
              </>
            )}
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-xs font-heading">HITL Escalation</Label>
        <Switch
          checked={config.hitlOnLowConfidence}
          onCheckedChange={(checked) =>
            onUpdate({ hitlOnLowConfidence: checked === true })
          }
        />
      </div>

      {config.hitlOnLowConfidence && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-heading">Confidence Threshold</Label>
            <span className="text-xs text-muted-foreground/60">
              {config.confidenceThreshold}
            </span>
          </div>
          <Slider
            value={[config.confidenceThreshold]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([v]) => onUpdate({ confidenceThreshold: v })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-heading">Output Schema</Label>
        <Textarea
          className={`${fieldClass} font-mono text-xs`}
          rows={3}
          value={
            config.outputSchema
              ? JSON.stringify(config.outputSchema, null, 2)
              : ""
          }
          onChange={(e) => {
            if (!e.target.value.trim()) {
              onUpdate({ outputSchema: undefined });
              return;
            }
            try {
              const parsed = JSON.parse(e.target.value);
              onUpdate({ outputSchema: parsed });
            } catch (err) {
              void err;
            }
          }}
          placeholder='{"type": "object", "properties": {...}}'
        />
        <p className="text-xs text-muted-foreground/60">
          Optional JSON Schema for structured output
        </p>
      </div>
    </div>
  );
}

interface WorkflowBlock {
  workflowId: string;
  blockName: string;
  blockDescription: string;
  inputSchema: WorkflowBlockField[];
}

function SubWorkflowForm({
  config,
  onUpdate,
}: {
  config: SubWorkflowStepConfig;
  onUpdate: (updates: Partial<SubWorkflowStepConfig>) => void;
}) {
  const [blocks, setBlocks] = useState<WorkflowBlock[]>([]);

  useEffect(() => {
    fetch("/api/workflow-blocks")
      .then((res) => res.json())
      .then((data) => setBlocks(data.blocks ?? []))
      .catch(() => setBlocks([]));
  }, []);

  const selectedBlock = blocks.find((b) => b.workflowId === config.workflowId);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-heading">Workflow Block</Label>
        <Select
          value={config.workflowId || ""}
          onValueChange={(v) =>
            onUpdate({ workflowId: v, inputMapping: {} })
          }
        >
          <SelectTrigger className={`w-full ${fieldClass}`}>
            <SelectValue placeholder="Select a workflow block..." />
          </SelectTrigger>
          <SelectContent>
            {blocks.map((b) => (
              <SelectItem key={b.workflowId} value={b.workflowId}>
                {b.blockName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedBlock?.blockDescription && (
          <p className="text-xs text-muted-foreground/60">
            {selectedBlock.blockDescription}
          </p>
        )}
      </div>

      {!config.workflowId && (
        <p className="text-xs text-muted-foreground/60 text-center py-4">
          Select a workflow block to configure input mapping
        </p>
      )}

      {selectedBlock && selectedBlock.inputSchema.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <Label className="text-xs font-heading">Input Mapping</Label>
            {selectedBlock.inputSchema.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label className="text-xs font-heading">
                  {field.name}
                  {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                </Label>
                {field.description && (
                  <p className="text-xs text-muted-foreground/60">{field.description}</p>
                )}
                <Input
                  className={fieldClass}
                  value={config.inputMapping[field.name] ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      inputMapping: {
                        ...config.inputMapping,
                        [field.name]: e.target.value,
                      },
                    })
                  }
                  placeholder={`{{input.${field.name}}} or {{steps.stepId.field}}`}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {config.workflowId && !selectedBlock && (
        <div className="space-y-2">
          <Separator />
          <Label className="text-xs font-heading">Workflow ID</Label>
          <Input
            className={fieldClass}
            value={config.workflowId}
            onChange={(e) => onUpdate({ workflowId: e.target.value })}
            placeholder="Workflow ID"
          />
          <p className="text-xs text-muted-foreground/60">
            Direct workflow ID (block not published yet)
          </p>
        </div>
      )}
    </div>
  );
}

export function ConfigPanel({
  workflow,
  onCollapse,
  className,
  hideHeader,
}: ConfigPanelProps): React.JSX.Element {
  const { selectedNode, updateNodeName, nodes } = workflow;

  if (!selectedNode) {
    return (
      <div className={className ?? "w-[300px] border-l bg-muted/30 flex flex-col h-full"}>
        {!hideHeader && (
          <div className="px-4 py-4 border-b bg-background flex items-center gap-2 shrink-0">
            {onCollapse && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCollapse}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Collapse Config panel"
              >
                <PanelRight className="size-4" />
              </Button>
            )}
            <h2 className="font-heading text-sm">Configure</h2>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Settings className="size-4 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-heading text-muted-foreground/90">
              No node selected
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Click a node on the canvas to find your{" "}
              <span className="font-heading italic">Flow</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  function onUpdate(config: StepConfig) {
    workflow.updateNodeConfig(selectedNode!.id, config as Partial<StepConfig>);
  }

  const config = selectedNode.config;

  return (
    <div className={className ?? "w-[300px] border-l bg-muted/30 flex flex-col h-full"}>
      {!hideHeader && (
        <div className="px-4 py-4 border-b bg-background flex items-center gap-2">
          {onCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Collapse Config panel"
            >
              <PanelRight className="size-4" />
            </Button>
          )}
          <h2 className="font-heading text-sm">Configure</h2>
        </div>
      )}
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-heading">Node Name</Label>
            <Input
              className={fieldClass}
              value={selectedNode.name}
              onChange={(e) => updateNodeName(selectedNode.id, e.target.value)}
            />
          </div>

          <Separator />

          {selectedNode.type === "trigger" && (
            <TriggerForm
              config={config as TriggerStepConfig}
              onUpdate={onUpdate}
            />
          )}
          {selectedNode.type === "llm" && (
            <LLMForm config={config as LLMStepConfig} onUpdate={onUpdate} />
          )}
          {selectedNode.type === "judge" && (
            <JudgeForm
              config={config as JudgeStepConfig}
              onUpdate={onUpdate}
              nodes={nodes}
              currentId={selectedNode.id}
            />
          )}
          {selectedNode.type === "hitl" && (
            <HITLForm
              config={config as HITLStepConfig}
              onUpdate={onUpdate}
              nodes={nodes}
              currentId={selectedNode.id}
            />
          )}
          {selectedNode.type === "connector" && (
            <ConnectorForm
              config={config as ConnectorStepConfig}
              onUpdate={onUpdate}
            />
          )}
          {selectedNode.type === "condition" && (
            <ConditionForm
              config={config as ConditionStepConfig}
              onUpdate={onUpdate}
            />
          )}
          {selectedNode.type === "agent" && (
            <AgentForm
              config={config as AgentStepConfig}
              onUpdate={(updates) =>
                onUpdate({ ...config, ...updates } as StepConfig)
              }
            />
          )}
          {selectedNode.type === "sub-workflow" && (
            <SubWorkflowForm
              config={config as SubWorkflowStepConfig}
              onUpdate={(updates) =>
                onUpdate({ ...config, ...updates } as StepConfig)
              }
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
