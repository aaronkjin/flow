"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import dagre from "@dagrejs/dagre";
import type {
  StepType,
  StepConfig,
  WorkflowDefinition,
  StepDefinition,
  EdgeDefinition,
} from "@/lib/engine/types";

// ── Exported types (consumed by Agent 5B) ──────────────────────────

export interface WorkflowNodeData {
  label: string;
  stepType: StepType;
  config: StepConfig;
  [key: string]: unknown; // required by React Flow v12 for Node<T> constraint
}

export interface UseWorkflowReturn {
  // React Flow state
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<WorkflowNodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Selection
  selectedNodeId: string | null;
  selectNode: (nodeId: string | null) => void;
  selectedNode: {
    id: string;
    type: StepType;
    name: string;
    config: StepConfig;
  } | null;

  // Node CRUD
  addNode: (
    type: StepType,
    position: { x: number; y: number },
    options?: { label?: string; configOverrides?: Partial<StepConfig> }
  ) => void;
  updateNodeConfig: (nodeId: string, updates: Partial<StepConfig>) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  deleteSelected: () => void;

  // Workflow metadata
  workflowName: string;
  setWorkflowName: (name: string) => void;
  workflowDescription: string;
  setWorkflowDescription: (desc: string) => void;

  // Persistence
  saveWorkflow: () => Promise<void>;
  runWorkflow: (input?: Record<string, unknown>) => Promise<string>;

  // Layout
  autoLayout: () => void;

  // Status
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  workflowId: string | null;
}

// ── Default configs per step type ──────────────────────────────────

const DEFAULT_CONFIGS: Record<StepType, StepConfig> = {
  trigger: { type: "trigger", triggerType: "manual" },
  llm: {
    type: "llm",
    model: "gpt-4o-mini",
    systemPrompt: "",
    userPrompt: "",
    temperature: 0.7,
    responseFormat: "text",
  },
  judge: {
    type: "judge",
    inputStepId: "",
    criteria: [],
    threshold: 0.8,
    model: "gpt-4o-mini",
  },
  hitl: {
    type: "hitl",
    instructions: "",
    showSteps: [],
    autoApproveOnJudgePass: false,
    judgeStepId: undefined,
    reviewTargetStepId: undefined,
  },
  connector: {
    type: "connector",
    connectorType: "slack",
    action: "send_message",
    params: {},
  },
  condition: { type: "condition", expression: "" },
};

const DEFAULT_LABELS: Record<StepType, string> = {
  trigger: "Trigger",
  llm: "LLM Action",
  judge: "Judge",
  hitl: "HITL Review",
  connector: "Connector",
  condition: "Condition",
};

// ── Dagre auto-layout helper ───────────────────────────────────────

function getLayoutedElements(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => g.setNode(node.id, { width: 200, height: 80 }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 100, y: pos.y - 40 } };
  });

  return { nodes: layoutedNodes, edges };
}

// ── Hook ────────────────────────────────────────────────────────────

export function useWorkflow(workflowId?: string): UseWorkflowReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | null>(
    workflowId ?? null
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const reactFlow = useReactFlow();
  const loadedRef = useRef(false);

  // ── Load workflow on mount ─────────────────────────────────────

  useEffect(() => {
    if (!workflowId || loadedRef.current) return;
    loadedRef.current = true;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) return;
        const { workflow } = (await res.json()) as {
          workflow: WorkflowDefinition;
        };

        setWorkflowName(workflow.name);
        setWorkflowDescription(workflow.description);

        // Deserialise steps → nodes
        const loadedNodes: Node<WorkflowNodeData>[] = workflow.steps.map(
          (step: StepDefinition) => ({
            id: step.id,
            type: step.type,
            position: step.position ?? { x: 0, y: 0 },
            data: {
              label: step.name,
              stepType: step.type,
              config: step.config,
            },
          })
        );

        // Deserialise edges
        const loadedEdges: Edge[] = workflow.edges.map(
          (edge: EdgeDefinition) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            label: edge.label,
            type: "workflow",
            animated: true,
          })
        );

        setNodes(loadedNodes);
        setEdges(loadedEdges);

        // Restore viewport
        if (workflow.canvasState?.viewport) {
          requestAnimationFrame(() => {
            reactFlow.setViewport(workflow.canvasState!.viewport);
          });
        }

        setIsDirty(false);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [workflowId, setNodes, setEdges, reactFlow]);

  // ── Selection ──────────────────────────────────────────────────

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;
    return {
      id: node.id,
      type: node.data.stepType,
      name: node.data.label,
      config: node.data.config,
    };
  }, [selectedNodeId, nodes]);

  // ── Node CRUD ──────────────────────────────────────────────────

  const addNode = useCallback(
    (
      type: StepType,
      position: { x: number; y: number },
      options?: { label?: string; configOverrides?: Partial<StepConfig> }
    ) => {
      const id = uuidv4();
      const baseConfig = { ...DEFAULT_CONFIGS[type] } as StepConfig;
      const config = options?.configOverrides
        ? ({ ...baseConfig, ...options.configOverrides } as StepConfig)
        : baseConfig;
      const newNode: Node<WorkflowNodeData> = {
        id,
        type,
        position,
        data: {
          label: options?.label ?? DEFAULT_LABELS[type],
          stepType: type,
          config,
        },
      };
      setNodes((prev) => [...prev, newNode]);
      setIsDirty(true);
    },
    [setNodes]
  );

  const updateNodeConfig = useCallback(
    (nodeId: string, updates: Partial<StepConfig>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: { ...node.data.config, ...updates } as StepConfig,
                },
              }
            : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  const updateNodeName = useCallback(
    (nodeId: string, name: string) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, label: name } }
            : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) =>
      prev.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      )
    );
    setSelectedNodeId(null);
    setIsDirty(true);
  }, [selectedNodeId, setNodes, setEdges]);

  // ── Edge connect ───────────────────────────────────────────────

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const edge: Edge = {
        ...connection,
        id: uuidv4(),
        type: "workflow",
        animated: true,
        label: connection.sourceHandle ?? undefined,
      };
      setEdges((prev) => addEdge(edge, prev));
      setIsDirty(true);
    },
    [setEdges]
  );

  // ── Wrap onNodesChange to track dirty ──────────────────────────

  const handleNodesChange: OnNodesChange<Node<WorkflowNodeData>> = useCallback(
    (changes) => {
      onNodesChange(changes);
      const hasMeaningfulChange = changes.some(
        (c) => c.type === "position" || c.type === "remove"
      );
      if (hasMeaningfulChange) {
        setIsDirty(true);
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      const hasMeaningfulChange = changes.some((c) => c.type === "remove");
      if (hasMeaningfulChange) {
        setIsDirty(true);
      }
    },
    [onEdgesChange]
  );

  // ── Serialisation helpers ──────────────────────────────────────

  const serialise = useCallback((): {
    steps: StepDefinition[];
    edges: EdgeDefinition[];
    canvasState: { viewport: { x: number; y: number; zoom: number } };
  } => {
    const steps: StepDefinition[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.stepType,
      name: node.data.label,
      config: node.data.config,
      position: node.position,
    }));

    const edgeDefs: EdgeDefinition[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      label: typeof edge.label === "string" ? edge.label : undefined,
    }));

    const viewport = reactFlow.getViewport();

    return { steps, edges: edgeDefs, canvasState: { viewport } };
  }, [nodes, edges, reactFlow]);

  // ── Persistence ────────────────────────────────────────────────

  const saveWorkflow = useCallback(async () => {
    setIsSaving(true);
    try {
      const { steps, edges: edgeDefs, canvasState } = serialise();

      if (savedWorkflowId) {
        // PUT update
        const res = await fetch(`/api/workflows/${savedWorkflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workflowName,
            description: workflowDescription,
            steps,
            edges: edgeDefs,
            canvasState,
          }),
        });
        if (!res.ok) throw new Error("Failed to update workflow");
      } else {
        // POST create
        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workflowName,
            description: workflowDescription,
            steps,
            edges: edgeDefs,
            canvasState,
          }),
        });
        if (!res.ok) throw new Error("Failed to create workflow");
        const { workflow } = (await res.json()) as {
          workflow: WorkflowDefinition;
        };
        setSavedWorkflowId(workflow.id);
      }
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }, [serialise, savedWorkflowId, workflowName, workflowDescription]);

  const runWorkflow = useCallback(
    async (input?: Record<string, unknown>): Promise<string> => {
      // Save first if dirty
      if (isDirty || !savedWorkflowId) {
        await saveWorkflow();
      }

      const wfId = savedWorkflowId;
      if (!wfId) throw new Error("Workflow must be saved before running");

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: wfId, input: input ?? {}, mode: "single" }),
      });
      if (!res.ok) throw new Error("Failed to start run");

      const { run } = (await res.json()) as { run: { id: string } };
      return run.id;
    },
    [isDirty, savedWorkflowId, saveWorkflow]
  );

  // ── Auto-layout ────────────────────────────────────────────────

  const autoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } =
      getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setIsDirty(true);
    requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.2 });
    });
  }, [nodes, edges, setNodes, setEdges, reactFlow]);

  // ── Return ─────────────────────────────────────────────────────

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,

    selectedNodeId,
    selectNode,
    selectedNode,

    addNode,
    updateNodeConfig,
    updateNodeName,
    deleteSelected,

    workflowName,
    setWorkflowName: useCallback(
      (name: string) => {
        setWorkflowName(name);
        setIsDirty(true);
      },
      []
    ),
    workflowDescription,
    setWorkflowDescription: useCallback(
      (desc: string) => {
        setWorkflowDescription(desc);
        setIsDirty(true);
      },
      []
    ),

    saveWorkflow,
    runWorkflow,

    autoLayout,

    isDirty,
    isSaving,
    isLoading,
    workflowId: savedWorkflowId,
  };
}
