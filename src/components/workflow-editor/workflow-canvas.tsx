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
import AgentNode from "./nodes/agent-node";
import SubWorkflowNode from "./nodes/sub-workflow-node";
import WorkflowEdge from "./edges/workflow-edge";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  llm: LLMNode,
  judge: JudgeNode,
  hitl: HITLNode,
  connector: ConnectorNode,
  condition: ConditionNode,
  agent: AgentNode,
  "sub-workflow": SubWorkflowNode,
};

const edgeTypes: EdgeTypes = {
  workflow: WorkflowEdge,
};

const defaultEdgeOptions = { type: "workflow", animated: true };

interface WorkflowCanvasProps {
  workflow: UseWorkflowReturn;
  focusedNodeId?: string;
}

export default function WorkflowCanvas({ workflow, focusedNodeId }: WorkflowCanvasProps) {
  const { onDragOver, onDrop } = useDragDrop(workflow.addNode);

  const snapGrid = useMemo<[number, number]>(() => [16, 16], []);

  const isPreview = !!workflow.previewNodes;

  const displayNodes = useMemo(() => {
    if (workflow.previewNodes) {
      return workflow.previewNodes.map((node) => ({
        ...node,
        draggable: false,
        selectable: false,
        deletable: false,
        className: "opacity-40 !transition-opacity",
      }));
    }
    if (!focusedNodeId) return workflow.nodes;
    return workflow.nodes.map((node) =>
      node.id === focusedNodeId
        ? { ...node, className: "ring-2 ring-orange-500/60 rounded-lg" }
        : node
    );
  }, [workflow.nodes, workflow.previewNodes, focusedNodeId]);

  const displayEdges = useMemo(() => {
    if (workflow.previewEdges) {
      return workflow.previewEdges.map((edge) => ({
        ...edge,
        deletable: false,
        selectable: false,
        focusable: false,
        style: { opacity: 0.35, strokeWidth: 1, stroke: "#d6d3cd" },
      }));
    }
    return workflow.edges;
  }, [workflow.edges, workflow.previewEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={isPreview ? undefined : workflow.onNodesChange}
        onEdgesChange={isPreview ? undefined : workflow.onEdgesChange}
        onConnect={isPreview ? undefined : workflow.onConnect}
        onNodeClick={isPreview ? undefined : (_: React.MouseEvent, node: Node) => workflow.selectNode(node.id)}
        onPaneClick={isPreview ? undefined : () => workflow.selectNode(null)}
        onDragOver={isPreview ? undefined : onDragOver}
        onDrop={isPreview ? undefined : onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!isPreview}
        nodesConnectable={!isPreview}
        elementsSelectable={!isPreview}
        snapToGrid
        snapGrid={snapGrid}
        fitView
        deleteKeyCode={isPreview ? [] : ["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <MiniMap style={{ opacity: 0.6 }} />
        <Background variant={BackgroundVariant.Dots} color="#e0ddd8" gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
