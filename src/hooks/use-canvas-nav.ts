"use client";

import { useState, useEffect, useCallback } from "react";
import type { Node } from "@xyflow/react";

interface UseCanvasNavOptions {
  nodes: Node[];
  enabled: boolean;
  onSelectNode: (nodeId: string) => void;
  onFocusNode?: (nodeId: string | null) => void;
}

interface UseCanvasNavReturn {
  focusedNodeId: string | null;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function getTopLeftNodeId(nodes: Node[]): string | null {
  if (nodes.length === 0) return null;
  const sorted = [...nodes].sort((a, b) => {
    const dy = a.position.y - b.position.y;
    if (dy !== 0) return dy;
    return a.position.x - b.position.x;
  });
  return sorted[0].id;
}

export function useCanvasNav({
  nodes,
  enabled,
  onSelectNode,
  onFocusNode,
}: UseCanvasNavOptions): UseCanvasNavReturn {
  const [rawFocusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [wasEnabled, setWasEnabled] = useState(false);

  let focusedNodeId = rawFocusedNodeId;
  if (enabled && !wasEnabled) {
    focusedNodeId = getTopLeftNodeId(nodes);
    setFocusedNodeId(focusedNodeId);
    setWasEnabled(true);
  } else if (!enabled && wasEnabled) {
    focusedNodeId = null;
    setFocusedNodeId(null);
    setWasEnabled(false);
  }

  const updateFocus = useCallback(
    (nodeId: string | null) => {
      setFocusedNodeId(nodeId);
      onFocusNode?.(nodeId);
    },
    [onFocusNode],
  );

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      if (!focusedNodeId) return;

      const current = nodes.find((n) => n.id === focusedNodeId);
      if (!current) return;

      let candidates: Node[] = [];

      switch (e.key) {
        case "ArrowRight":
          candidates = nodes.filter(
            (n) => n.position.x > current.position.x,
          );
          break;
        case "ArrowLeft":
          candidates = nodes.filter(
            (n) => n.position.x < current.position.x,
          );
          break;
        case "ArrowDown":
          candidates = nodes.filter(
            (n) => n.position.y > current.position.y,
          );
          break;
        case "ArrowUp":
          candidates = nodes.filter(
            (n) => n.position.y < current.position.y,
          );
          break;
        case "Enter":
          e.preventDefault();
          onSelectNode(focusedNodeId);
          return;
        default:
          return;
      }

      if (candidates.length === 0) return;

      e.preventDefault();
      let closest = candidates[0];
      let closestDist = Infinity;
      for (const c of candidates) {
        const dx = c.position.x - current.position.x;
        const dy = c.position.y - current.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = c;
        }
      }
      updateFocus(closest.id);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, focusedNodeId, nodes, onSelectNode, updateFocus]);

  return { focusedNodeId };
}
