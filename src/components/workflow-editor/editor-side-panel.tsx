"use client";

import { useState } from "react";
import { ConfigPanel } from "./config-panel";
import { CopilotPanel } from "./copilot-panel";
import { Button } from "@/components/ui/button";
import { PanelRight } from "lucide-react";
import type { UseWorkflowReturn } from "./hooks/use-workflow";

interface EditorSidePanelProps {
  workflow: UseWorkflowReturn;
  onCollapse?: () => void;
}

export function EditorSidePanel({
  workflow,
  onCollapse,
}: EditorSidePanelProps) {
  const hasSelection = workflow.selectedNode !== null;

  const [userOverride, setUserOverride] = useState<{
    tab: "config" | "chat";
    selectionState: boolean;
  } | null>(null);

  const activeTab =
    userOverride && userOverride.selectionState === hasSelection
      ? userOverride.tab
      : hasSelection
        ? "config"
        : "chat";

  function handleTabSwitch(tab: "config" | "chat") {
    setUserOverride({ tab, selectionState: hasSelection });
  }

  return (
    <div className="w-[300px] border-l bg-muted/30 flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-4 border-b shrink-0">
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="shrink-0 text-muted-foreground hover:text-foreground mr-1"
            aria-label="Collapse panel"
          >
            <PanelRight className="size-4" />
          </Button>
        )}
        <button
          onClick={() => handleTabSwitch("config")}
          className={`px-3 py-1 text-xs font-heading rounded-md transition-colors ${
            activeTab === "config"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Config
        </button>
        <button
          onClick={() => handleTabSwitch("chat")}
          className={`px-3 py-1 text-xs font-heading rounded-md transition-colors ${
            activeTab === "chat"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Chat
        </button>
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === "config" ? "" : "hidden"}`}>
        <ConfigPanel
          workflow={workflow}
          className="flex-1 flex flex-col h-full"
          hideHeader
        />
      </div>
      <div className={`flex-1 overflow-hidden ${activeTab === "chat" ? "" : "hidden"}`}>
        <CopilotPanel workflow={workflow} />
      </div>
    </div>
  );
}
