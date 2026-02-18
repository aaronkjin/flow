"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflow } from "@/components/workflow-editor/hooks/use-workflow";
import WorkflowCanvas from "@/components/workflow-editor/workflow-canvas";
import { BlockPalette } from "@/components/workflow-editor/block-palette";
import { ConfigPanel } from "@/components/workflow-editor/config-panel";
import { Toolbar } from "@/components/workflow-editor/toolbar";
import { Button } from "@/components/ui/button";
import { Loader2, PanelRight, PanelLeft } from "lucide-react";

function EditorContent({ workflowId }: { workflowId: string }) {
  const workflow = useWorkflow(workflowId);
  const [blocksCollapsed, setBlocksCollapsed] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false);

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
          <BlockPalette onCollapse={() => setBlocksCollapsed(true)} />
        )}
        <div className="flex-1">
          <WorkflowCanvas workflow={workflow} />
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
          <ConfigPanel
            workflow={workflow}
            onCollapse={() => setConfigCollapsed(true)}
          />
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
