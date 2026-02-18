"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface ZoneNavContextValue {
  zones: string[];
  activeZone: string | null;
  isLocked: boolean;
  setZones: (zones: string[]) => void;
  setActiveZone: (zone: string | null) => void;
  lockZone: () => void;
  unlockZone: () => void;
}

const ZoneNavContext = createContext<ZoneNavContextValue | null>(null);

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function ZoneNavProvider({ children }: { children: ReactNode }) {
  const [rawZones, setRawZones] = useState<string[]>(["sidebar", "content"]);
  const [rawActiveZone, setRawActiveZone] = useState<string | null>(null);
  const [rawIsLocked, setRawIsLocked] = useState(false);

  // Reset on page navigation
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setRawActiveZone(null);
    setRawIsLocked(false);
  }

  // Clamp activeZone to valid zones
  const zones = rawZones;
  const activeZone =
    rawActiveZone !== null && zones.includes(rawActiveZone)
      ? rawActiveZone
      : null;
  const isLocked = activeZone !== null ? rawIsLocked : false;

  const setZones = useCallback((newZones: string[]) => {
    setRawZones(newZones);
    setRawIsLocked(false);
    setRawActiveZone(null);
  }, []);

  const lockZone = useCallback(() => setRawIsLocked(true), []);
  const unlockZone = useCallback(() => setRawIsLocked(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      if (isLocked) {
        // When locked, only handle Escape to unlock
        if (e.key === "Escape") {
          e.preventDefault();
          setRawIsLocked(false);
        }
        return;
      }

      // Not locked below this point

      // Escape clears zone selection entirely
      if (e.key === "Escape" && activeZone !== null) {
        e.preventDefault();
        setRawActiveZone(null);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (activeZone === null) {
          // First activation: start at second zone (content area) or first
          setRawActiveZone(zones.length > 1 ? zones[1] : zones[0] ?? null);
        } else {
          const currentIdx = zones.indexOf(activeZone);
          const nextIdx =
            e.key === "ArrowRight"
              ? (currentIdx + 1) % zones.length
              : (currentIdx - 1 + zones.length) % zones.length;
          setRawActiveZone(zones[nextIdx]);
        }
        return;
      }

      if (e.key === "Enter" && activeZone !== null) {
        e.preventDefault();
        setRawIsLocked(true);
        return;
      }

      // Auto-lock on Up/Down when a zone is active — this prevents
      // accidental Left/Right zone switches while navigating items.
      // Individual hooks (useKeyboardNav) handle the actual Up/Down navigation.
      if (
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        activeZone !== null
      ) {
        setRawIsLocked(true);
        // Don't preventDefault — let individual hooks handle the arrow key
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [zones, activeZone, isLocked]);

  return (
    <ZoneNavContext.Provider
      value={{
        zones,
        activeZone,
        isLocked,
        setZones,
        setActiveZone: setRawActiveZone,
        lockZone,
        unlockZone,
      }}
    >
      {children}
    </ZoneNavContext.Provider>
  );
}

export function useZoneNav() {
  const ctx = useContext(ZoneNavContext);
  if (!ctx) throw new Error("useZoneNav must be used within ZoneNavProvider");
  return ctx;
}
