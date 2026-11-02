"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const tab =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Barra inferior fixa no celular (até lg). Itens secundários ficam em "Mais". */
export function MobileNav({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const secondaryActive = secondary.some((i) => isActive(pathname, i.href));

  return (
    <nav
      aria-label="Navegação principal"
      className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch gap-1 px-2">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(tab, active && "text-primary")}
            >
              <Icon className="size-5" />
              {item.short}
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className={cn(tab, secondaryActive && "text-primary")}>
            <EllipsisIcon className="size-5" />
            Mais
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader>
              <SheetTitle>Mais opções</SheetTitle>
              <SheetDescription className="sr-only">Outras páginas do painel</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 pb-4">
              {secondary.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-accent",
                      active && "bg-primary/10 text-primary",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                );
              })}
              {footer && <div className="mt-2 rounded-lg border px-3 py-2">{footer}</div>}
              <div className="mt-2 flex h-12 items-center justify-between rounded-lg border px-3">
                <span className="text-sm font-medium">Tema</span>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
