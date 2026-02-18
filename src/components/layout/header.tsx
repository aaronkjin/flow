"use client";

import Link from "next/link";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export function Header({ title, breadcrumbs, actions, badge }: HeaderProps) {
  return (
    <div className="relative px-8 py-5 border-b">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-1.5">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/40">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground/70">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-normal">{title}</h1>
          {badge}
        </div>
        {actions && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
