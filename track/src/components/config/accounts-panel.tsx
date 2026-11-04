"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountView } from "@/lib/config/types";
import type { AccountKind } from "@/lib/config/validation";
import { AccountCard } from "./account-card";
import { AccountDialog } from "./account-dialog";
import { KIND_META } from "./kinds";

export function AccountsPanel({
  kind,
  accounts,
  timeZone,
}: {
  kind: AccountKind;
  accounts: AccountView[];
  timeZone: string;
}) {
  const meta = KIND_META[kind];
  const activeCount = accounts.filter((a) => a.active).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{meta.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
          {accounts.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="num">{activeCount}</span> de <span className="num">{accounts.length}</span> ativa(s)
            </p>
          )}
        </div>
        <AccountDialog
          kind={kind}
          trigger={
            <Button className="h-11 w-full sm:w-auto">
              <PlusIcon /> Adicionar {meta.noun}
            </Button>
          }
        />
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{meta.empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} timeZone={timeZone} />
          ))}
        </div>
      )}
    </section>
  );
}
