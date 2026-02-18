"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { StepConfig, StepType } from "@/lib/engine/types";

export function useDragDrop(
  addNode: (
    type: StepType,
    position: { x: number; y: number },
    options?: { label?: string; configOverrides?: Record<string, unknown> }
  ) => void
): {
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
} {
  const reactFlow = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;

      const payload = JSON.parse(raw) as {
        type: StepType;
        label?: string;
        config?: Record<string, unknown>;
      };
      const { type, label, config } = payload;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position, {
        label,
        configOverrides: config as Partial<StepConfig>,
      });
    },
    [addNode, reactFlow]
  );

  return { onDragOver, onDrop };
}
