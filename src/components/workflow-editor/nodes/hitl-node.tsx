"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../hooks/use-workflow";
import type { HITLStepConfig } from "@/lib/engine/types";

function HITLNode({
  data,
  selected,
}: NodeProps<Node<WorkflowNodeData>>) {
  const config = data.config as HITLStepConfig;

  return (
    <div
      className={cn(
        "rounded-lg border border-emerald-400/20 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow min-w-[180px] p-3",
        selected && "ring-1 ring-foreground/20 ring-offset-2"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-stone-300"
      />

      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-emerald-400" />
        <span className="font-heading font-medium text-sm">{data.label}</span>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-1">
        {config.autoApproveOnJudgePass ? "auto-approve on" : "manual review"}
      </p>

      <Handle
        type="source"
        position={Position.Bottom}
        id="approve"
        style={{ left: "30%" }}
        className="!bg-stone-300"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="reject"
        style={{ left: "70%" }}
        className="!bg-stone-300"
      />

      <div className="flex justify-between mt-2 px-1">
        <span className="text-[10px] text-muted-foreground/50">approve</span>
        <span className="text-[10px] text-muted-foreground/50">reject</span>
      </div>
    </div>
  );
}

export default memo(HITLNode);
