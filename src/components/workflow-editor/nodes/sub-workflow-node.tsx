"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../hooks/use-workflow";
import type { SubWorkflowStepConfig } from "@/lib/engine/types";

function SubWorkflowNode({
  data,
  selected,
}: NodeProps<Node<WorkflowNodeData>>) {
  const config = data.config as SubWorkflowStepConfig;

  return (
    <div
      className={cn(
        "rounded-lg border border-orange-400/20 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow min-w-[180px] p-3",
        selected && "ring-1 ring-foreground/20 ring-offset-2"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-stone-300"
      />

      <div className="flex items-center gap-2">
        <Workflow className="h-4 w-4 text-orange-400" />
        <span className="font-heading font-medium text-sm">{data.label}</span>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-1 truncate">
        {config.workflowId
          ? config.workflowId.slice(0, 20) + (config.workflowId.length > 20 ? "..." : "")
          : "Not configured"}
      </p>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-stone-300"
      />
    </div>
  );
}

export default memo(SubWorkflowNode);
