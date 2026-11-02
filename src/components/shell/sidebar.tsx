"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Navegação lateral — só aparece a partir de lg (desktop). */
export function Sidebar({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="glass sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-y-0 border-l-0 lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-primary/10 text-foreground",
              )}
            >
              {active && (
                <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
              )}
              <Icon className={cn("size-4.5", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-2 border-t px-4 py-3">
        {footer}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
