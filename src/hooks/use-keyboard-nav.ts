"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseKeyboardNavOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  enabled?: boolean;
}

interface UseKeyboardNavReturn {
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  getItemProps: (index: number) => {
    "data-focused": boolean;
    "data-keyboard-focused": boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
    ref: (el: HTMLElement | null) => void;
  };
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardNav({
  itemCount,
  onSelect,
  enabled = true,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const [rawFocusedIndex, setFocusedIndex] = useState(-1);
  const [focusSource, setFocusSource] = useState<"keyboard" | "mouse" | null>(
    null,
  );
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Clamp focused index to valid range without an effect
  const focusedIndex = rawFocusedIndex >= itemCount ? -1 : rawFocusedIndex;

  // Scroll into view when focusedIndex changes via keyboard
  const scrollToFocused = useCallback((index: number) => {
    const el = itemRefs.current.get(index);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      if (itemCount === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = focusedIndex < itemCount - 1 ? focusedIndex + 1 : 0;
          setFocusedIndex(next);
          setFocusSource("keyboard");
          scrollToFocused(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = focusedIndex > 0 ? focusedIndex - 1 : itemCount - 1;
          setFocusedIndex(prev);
          setFocusSource("keyboard");
          scrollToFocused(prev);
          break;
        }
        case "Enter": {
          if (focusedIndex >= 0) {
            e.preventDefault();
            onSelect(focusedIndex);
          }
          break;
        }
        case "Escape": {
          setFocusedIndex(-1);
          setFocusSource(null);
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, itemCount, focusedIndex, onSelect, scrollToFocused]);

  const getItemProps = useCallback(
    (index: number) => ({
      "data-focused": focusedIndex === index,
      "data-keyboard-focused":
        focusedIndex === index && focusSource === "keyboard",
      onMouseEnter: () => {
        setFocusedIndex(index);
        setFocusSource("mouse");
      },
      onMouseLeave: () => {
        // Keep the index — don't reset on mouse leave
      },
      onClick: () => onSelect(index),
      ref: (el: HTMLElement | null) => {
        if (el) {
          itemRefs.current.set(index, el);
        } else {
          itemRefs.current.delete(index);
        }
      },
    }),
    [focusedIndex, focusSource, onSelect],
  );

  return { focusedIndex, setFocusedIndex, getItemProps };
}
