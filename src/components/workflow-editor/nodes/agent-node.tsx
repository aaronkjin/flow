"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../hooks/use-workflow";
import type { AgentStepConfig } from "@/lib/engine/types";

function AgentNode({
  data,
  selected,
}: NodeProps<Node<WorkflowNodeData>>) {
  const config = data.config as AgentStepConfig;

  return (
    <div
      className={cn(
        "rounded-lg border border-rose-400/20 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow min-w-[180px] p-3",
        selected && "ring-1 ring-foreground/20 ring-offset-2"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-stone-300"
      />

      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-rose-400" />
        <span className="font-heading font-medium text-sm">{data.label}</span>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-1">
        {config.model} | {config.tools?.length ?? 0} tools | max {config.maxIterations ?? 10} iter
      </p>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-stone-300"
      />
    </div>
  );
}

export default memo(AgentNode);
