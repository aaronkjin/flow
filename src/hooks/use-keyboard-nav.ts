"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseKeyboardNavOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  enabled?: boolean;
  gridColumns?: number;
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
  gridColumns = 1,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const [rawFocusedIndex, setFocusedIndex] = useState(-1);
  const [focusSource, setFocusSource] = useState<"keyboard" | "mouse" | null>(
    null,
  );
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  const focusedIndex = rawFocusedIndex >= itemCount ? -1 : rawFocusedIndex;

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

      const cols = gridColumns;
      const totalRows = Math.ceil(itemCount / cols);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          let next: number;
          if (cols > 1 && focusedIndex >= 0) {
            const row = Math.floor(focusedIndex / cols);
            const col = focusedIndex % cols;
            const nextRow = (row + 1) % totalRows;
            const target = nextRow * cols + col;
            next = target >= itemCount ? itemCount - 1 : target;
          } else {
            next = focusedIndex < itemCount - 1 ? focusedIndex + 1 : 0;
          }
          setFocusedIndex(next);
          setFocusSource("keyboard");
          scrollToFocused(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          let prev: number;
          if (cols > 1 && focusedIndex >= 0) {
            const row = Math.floor(focusedIndex / cols);
            const col = focusedIndex % cols;
            const prevRow = (row - 1 + totalRows) % totalRows;
            const target = prevRow * cols + col;
            prev = target >= itemCount ? itemCount - 1 : target;
          } else {
            prev = focusedIndex > 0 ? focusedIndex - 1 : itemCount - 1;
          }
          setFocusedIndex(prev);
          setFocusSource("keyboard");
          scrollToFocused(prev);
          break;
        }
        case "ArrowRight": {
          if (cols > 1 && focusedIndex >= 0) {
            const col = focusedIndex % cols;
            const target = focusedIndex + 1;
            if (col + 1 < cols && target < itemCount) {
              e.preventDefault();
              setFocusedIndex(target);
              setFocusSource("keyboard");
              scrollToFocused(target);
            }
          }
          break;
        }
        case "ArrowLeft": {
          if (cols > 1 && focusedIndex >= 0) {
            const col = focusedIndex % cols;
            if (col > 0) {
              e.preventDefault();
              const target = focusedIndex - 1;
              setFocusedIndex(target);
              setFocusSource("keyboard");
              scrollToFocused(target);
            }
          }
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
  }, [enabled, itemCount, focusedIndex, onSelect, scrollToFocused, gridColumns]);

  const getItemProps = useCallback(
    (index: number) => ({
      "data-focused": focusedIndex === index,
      "data-keyboard-focused":
        focusedIndex === index && focusSource === "keyboard",
      onMouseEnter: () => {
        setFocusedIndex(index);
        setFocusSource("mouse");
      },
      onMouseLeave: () => {},
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
