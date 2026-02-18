"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { UseWorkflowReturn } from "./hooks/use-workflow";
import { useDragDrop } from "./hooks/use-drag-drop";

import TriggerNode from "./nodes/trigger-node";
import LLMNode from "./nodes/llm-node";
import JudgeNode from "./nodes/judge-node";
import HITLNode from "./nodes/hitl-node";
import ConnectorNode from "./nodes/connector-node";
import ConditionNode from "./nodes/condition-node";
import WorkflowEdge from "./edges/workflow-edge";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  llm: LLMNode,
  judge: JudgeNode,
  hitl: HITLNode,
  connector: ConnectorNode,
  condition: ConditionNode,
};

const edgeTypes: EdgeTypes = {
  workflow: WorkflowEdge,
};

const defaultEdgeOptions = { type: "workflow", animated: true };

interface WorkflowCanvasProps {
  workflow: UseWorkflowReturn;
}

export default function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  const { onDragOver, onDrop } = useDragDrop(workflow.addNode);

  const snapGrid = useMemo<[number, number]>(() => [16, 16], []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={workflow.nodes}
        edges={workflow.edges}
        onNodesChange={workflow.onNodesChange}
        onEdgesChange={workflow.onEdgesChange}
        onConnect={workflow.onConnect}
        onNodeClick={(_: React.MouseEvent, node: Node) => workflow.selectNode(node.id)}
        onPaneClick={() => workflow.selectNode(null)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid
        snapGrid={snapGrid}
        fitView
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <MiniMap style={{ opacity: 0.6 }} />
        <Background variant={BackgroundVariant.Dots} color="#e0ddd8" gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
