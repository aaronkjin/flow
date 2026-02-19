"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflow } from "@/components/workflow-editor/hooks/use-workflow";
import { useZoneNav } from "@/hooks/use-zone-nav";
import { useCanvasNav } from "@/hooks/use-canvas-nav";
import WorkflowCanvas from "@/components/workflow-editor/workflow-canvas";
import { BlockPalette } from "@/components/workflow-editor/block-palette";
import { EditorSidePanel } from "@/components/workflow-editor/editor-side-panel";
import { Toolbar } from "@/components/workflow-editor/toolbar";
import { Button } from "@/components/ui/button";
import { Loader2, PanelRight, PanelLeft } from "lucide-react";

function EditorContent({ workflowId }: { workflowId: string }) {
  const workflow = useWorkflow(workflowId);
  const { setZones, activeZone, isLocked } = useZoneNav();
  const [blocksCollapsed, setBlocksCollapsed] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false);

  useEffect(() => {
    setZones(["sidebar", "palette", "canvas", "config"]);
  }, [setZones]);

  const isCanvasLocked = activeZone === "canvas" && isLocked;
  const isPaletteActive = activeZone === "palette";

  const { focusedNodeId } = useCanvasNav({
    nodes: workflow.nodes,
    enabled: isCanvasLocked,
    onSelectNode: (nodeId) => workflow.selectNode(nodeId),
    onFocusNode: () => {},
  });

  const zoneOutline = (zone: string) => {
    if (activeZone === zone && isLocked)
      return "outline outline-2 outline-orange-500/80 outline-offset-[-2px] rounded-lg";
    if (activeZone === zone)
      return "outline outline-2 outline-orange-500/50 outline-offset-[-2px] rounded-lg";
    return "";
  };

  if (workflow.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar workflow={workflow} />
      <div className="flex flex-1 overflow-hidden">
        {blocksCollapsed ? (
          <div className="w-10 flex flex-col items-center border-r bg-background shrink-0 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setBlocksCollapsed(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Expand Blocks panel"
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className={`relative ${zoneOutline("palette")}`}>
            <BlockPalette
              onCollapse={() => setBlocksCollapsed(true)}
              isActive={isPaletteActive}
              addNode={workflow.addNode}
            />
          </div>
        )}
        <div className="flex-1 relative">
          <WorkflowCanvas workflow={workflow} focusedNodeId={focusedNodeId ?? undefined} />
          {activeZone === "canvas" && (
            <div
              className={`absolute inset-0 pointer-events-none z-50 rounded-lg border-2 ${
                isLocked ? "border-orange-500/80" : "border-orange-500/50"
              }`}
            />
          )}
        </div>
        {configCollapsed ? (
          <div className="w-10 flex flex-col items-center border-l bg-muted/30 shrink-0 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfigCollapsed(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Expand Config panel"
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
        ) : (
          <div className={`relative ${zoneOutline("config")}`}>
            <EditorSidePanel
              workflow={workflow}
              onCollapse={() => setConfigCollapsed(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditWorkflowPage() {
  const params = useParams<{ workflowId: string }>();

  return (
    <ReactFlowProvider>
      <EditorContent workflowId={params.workflowId} />
    </ReactFlowProvider>
  );
}
