"use client";

import React, { useMemo } from "react";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import {
  Sparkles,
  Scale,
  UserCheck,
  Plug,
  GitBranch,
  Database,
  Hand,
  Mail,
  Globe,
  FileText,
  Sheet,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { StepType } from "@/lib/engine/types";

interface PaletteItem {
  label: string;
  description: string;
  stepType: StepType;
  icon: LucideIcon;
  dragData?: Record<string, unknown>;
}

interface PaletteCategory {
  name: string;
  items: PaletteItem[];
}

const categories: PaletteCategory[] = [
  {
    name: "Triggers",
    items: [
      {
        label: "Dataset",
        description: "Replay a dataset",
        stepType: "trigger",
        icon: Database,
        dragData: { triggerType: "dataset" },
      },
      {
        label: "Manual",
        description: "Manual input trigger",
        stepType: "trigger",
        icon: Hand,
        dragData: { triggerType: "manual" },
      },
    ],
  },
  {
    name: "AI",
    items: [
      {
        label: "LLM Action",
        description: "Run an LLM prompt",
        stepType: "llm",
        icon: Sparkles,
        dragData: {},
      },
      {
        label: "Judge",
        description: "Evaluate with criteria",
        stepType: "judge",
        icon: Scale,
        dragData: {},
      },
    ],
  },
  {
    name: "Review",
    items: [
      {
        label: "HITL Review",
        description: "Human-in-the-loop review",
        stepType: "hitl",
        icon: UserCheck,
        dragData: {},
      },
    ],
  },
  {
    name: "Actions",
    items: [
      {
        label: "Slack",
        description: "Send a Slack message",
        stepType: "connector",
        icon: Plug,
        dragData: { connectorType: "slack", action: "send_message" },
      },
      {
        label: "Email",
        description: "Send an email",
        stepType: "connector",
        icon: Mail,
        dragData: { connectorType: "email", action: "send_email" },
      },
      {
        label: "HTTP Webhook",
        description: "Make an HTTP request",
        stepType: "connector",
        icon: Globe,
        dragData: { connectorType: "http", action: "request" },
      },
      {
        label: "Notion",
        description: "Create or update pages",
        stepType: "connector",
        icon: FileText,
        dragData: { connectorType: "notion", action: "create_page" },
      },
      {
        label: "Google Sheets",
        description: "Append or read rows",
        stepType: "connector",
        icon: Sheet,
        dragData: { connectorType: "google-sheets", action: "append_row" },
      },
    ],
  },
  {
    name: "Logic",
    items: [
      {
        label: "Condition",
        description: "Branch on expression",
        stepType: "condition",
        icon: GitBranch,
        dragData: {},
      },
    ],
  },
];

const typeColors: Record<StepType, string> = {
  trigger: "text-stone-400",
  llm: "text-sky-400",
  judge: "text-amber-400",
  hitl: "text-emerald-400",
  connector: "text-violet-400",
  condition: "text-stone-400",
};

interface PaletteItemCardProps {
  item: PaletteItem;
  isKbFocused?: boolean;
  focusRef?: (el: HTMLElement | null) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function PaletteItemCard({ item, isKbFocused, focusRef, onMouseEnter, onMouseLeave }: PaletteItemCardProps) {
  const Icon = item.icon;

  function onDragStart(event: React.DragEvent) {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({
        type: item.stepType,
        label: item.label,
        config: item.dragData ?? {},
      })
    );
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      ref={focusRef}
      draggable
      onDragStart={onDragStart}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors ${
        isKbFocused
          ? "bg-orange-500/[0.06] outline outline-2 outline-orange-500/50 outline-offset-[-2px] border-orange-500/30"
          : "border-border/60 hover:bg-muted/30"
      }`}
    >
      <Icon className={`size-4 shrink-0 ${typeColors[item.stepType]}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{item.label}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
          {item.description}
        </p>
      </div>
    </div>
  );
}

interface BlockPaletteProps {
  onCollapse?: () => void;
  isActive?: boolean;
  addNode?: (
    type: StepType,
    position: { x: number; y: number },
    options?: { label?: string; configOverrides?: Partial<Record<string, unknown>> }
  ) => void;
}

export function BlockPalette({ onCollapse, isActive, addNode }: BlockPaletteProps): React.JSX.Element {
  const flatItems = useMemo(
    () => categories.flatMap((c) => c.items),
    [],
  );

  const { getItemProps } = useKeyboardNav({
    itemCount: flatItems.length,
    onSelect: (index) => {
      if (!addNode) return;
      const item = flatItems[index];
      addNode(item.stepType, { x: 300, y: 300 }, {
        label: item.label,
        configOverrides: item.dragData as Partial<Record<string, unknown>>,
      });
    },
    enabled: isActive ?? false,
  });

  // Build a map from flat index to category/item for rendering
  let flatIndex = 0;

  return (
    <div className="w-60 border-r bg-background flex flex-col h-full">
      <div className="px-4 py-4 border-b flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm">Blocks</h2>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Collapse Blocks panel"
          >
            <PanelLeft className="size-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4 space-y-5">
          {categories.map((category, i) => (
            <div key={category.name}>
              {i > 0 && <Separator className="mb-5" />}
              <h3 className="font-heading text-[11px] tracking-widest uppercase text-muted-foreground/60 mb-2.5 px-1">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.items.map((item) => {
                  const idx = flatIndex++;
                  const props = getItemProps(idx);
                  return (
                    <PaletteItemCard
                      key={item.label}
                      item={item}
                      isKbFocused={props["data-keyboard-focused"]}
                      focusRef={props.ref}
                      onMouseEnter={props.onMouseEnter}
                      onMouseLeave={props.onMouseLeave}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
