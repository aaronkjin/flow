"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../hooks/use-workflow";
import type { LLMStepConfig } from "@/lib/engine/types";

function LLMNode({
  data,
  selected,
}: NodeProps<Node<WorkflowNodeData>>) {
  const config = data.config as LLMStepConfig;

  return (
    <div
      className={cn(
        "rounded-lg border border-sky-400/20 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow min-w-[180px] p-3",
        selected && "ring-1 ring-foreground/20 ring-offset-2"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-stone-300"
      />

      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sky-400" />
        <span className="font-heading font-medium text-sm">{data.label}</span>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-1">{config.model}</p>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-stone-300"
      />
    </div>
  );
}

export default memo(LLMNode);
