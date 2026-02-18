"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Workflow,
  Play,
  UserCheck,
  Menu,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Runs", icon: Play },
  { href: "/review", label: "Review", icon: UserCheck },
];

function NavContent({
  pathname,
  reviewCount,
}: {
  pathname: string;
  reviewCount: number;
}) {
  return (
    <>
      <div className="px-5 py-6">
        <Link
          href="/"
          className="font-heading text-5xl tracking-tight italic hover:opacity-80 transition-opacity"
        >
          Action
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={`w-full justify-start gap-2.5 text-sm font-normal ${
                isActive
                  ? "bg-muted/50 font-medium border-l-2 border-foreground rounded-l-none"
                  : ""
              }`}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
                {item.label === "Review" && reviewCount > 0 && (
                  <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] font-medium">
                    {reviewCount}
                  </span>
                )}
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-muted-foreground/40">v0.1</div>
    </>
  );
}

const SIDEBAR_COLLAPSED_KEY = "action-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    const id = requestAnimationFrame(() => setCollapsed(stored));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  }

  useEffect(() => {
    let active = true;

    async function fetchReviewCount() {
      try {
        const res = await fetch("/api/review");
        if (res.ok) {
          const { reviews } = (await res.json()) as { reviews: unknown[] };
          if (active) setReviewCount(reviews?.length ?? 0);
        }
      } catch {
        // ignore fetch errors
      }
    }

    fetchReviewCount();
    const interval = setInterval(fetchReviewCount, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 z-40 p-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <NavContent pathname={pathname} reviewCount={reviewCount} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col h-screen border-r bg-background shrink-0 transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-12" : "w-60"
        }`}
      >
        {collapsed ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center px-2 py-5 border-b">
              <Link
                href="/"
                className="font-heading text-2xl tracking-tight italic hover:opacity-80 transition-opacity"
              >
                A
              </Link>
            </div>
            <div className="flex flex-col items-center py-3 gap-3 flex-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    size="icon"
                    asChild
                    className={isActive ? "bg-muted/50" : ""}
                  >
                    <Link href={item.href} title={item.label}>
                      <item.icon className="size-5" />
                    </Link>
                  </Button>
                );
              })}
            </div>
            <div className="px-2 py-4 flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="size-5" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-6">
              <Link
                href="/"
                className="font-heading text-5xl tracking-tight italic hover:opacity-80 transition-opacity"
              >
                Action
              </Link>
            </div>
            <nav className="flex-1 flex flex-col gap-1 px-3">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className={`w-full justify-start gap-2.5 text-sm font-normal ${
                      isActive
                        ? "bg-muted/50 font-medium border-l-2 border-foreground rounded-l-none"
                        : ""
                    }`}
                    asChild
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      {item.label}
                      {item.label === "Review" && reviewCount > 0 && (
                        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] font-medium">
                          {reviewCount}
                        </span>
                      )}
                    </Link>
                  </Button>
                );
              })}
            </nav>
            <div className="px-3 py-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground/40">v0.1</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="size-5" />
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
