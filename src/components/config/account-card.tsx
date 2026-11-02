"use client";

import { LoaderCircleIcon, PencilIcon, PlugZapIcon, Trash2Icon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccount, setAccountActive, testAccount } from "@/app/painel/config/actions";
import { GlassCard } from "@/components/glass-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AccountView } from "@/lib/config/types";
import { AccountDialog } from "./account-dialog";
import { KIND_META } from "./kinds";
import { TestStatus } from "./test-status";

export function AccountCard({ account }: { account: AccountView }) {
  const meta = KIND_META[account.kind];
  const [testing, startTest] = useTransition();
  const [removing, startRemove] = useTransition();
  const [, startToggle] = useTransition();
  const [active, setOptimisticActive] = useOptimistic(account.active);

  return (
    <GlassCard className="gap-3 px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{account.label}</h3>
            <Badge variant={active ? "secondary" : "outline"} className={active ? "text-primary" : "text-muted-foreground"}>
              {active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{meta.externalLabel}</dt>
            <dd className="num truncate">{account.kind === "ads" ? `act_${account.externalId}` : account.externalId}</dd>
            <dt className="text-muted-foreground">Segredo</dt>
            <dd className="num">{account.secretHint}</dd>
          </dl>
        </div>
        <Switch
          checked={active}
          aria-label={active ? "Desativar conta" : "Ativar conta"}
          onCheckedChange={(value) =>
            startToggle(async () => {
              setOptimisticActive(value);
              const result = await setAccountActive(account.kind, account.id, value);
              if (result.ok) toast.success(result.message);
              else toast.error(result.error);
            })
          }
        />
      </div>

      <TestStatus account={account} />

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          variant="outline"
          className="h-10 flex-1 sm:flex-none"
          disabled={testing}
          onClick={() =>
            startTest(async () => {
              const result = await testAccount(account.kind, account.id);
              if (!result.ok) return void toast.error(result.error);
              const test = result.data!;
              if (test.status === "ok") toast.success(test.message);
              else if (test.status === "warning") toast.warning(test.message);
              else toast.error(test.message);
            })
          }
        >
          {testing ? <LoaderCircleIcon className="animate-spin" /> : <PlugZapIcon />}
          Testar conexão
        </Button>
        <AccountDialog
          kind={account.kind}
          account={account}
          trigger={
            <Button variant="ghost" className="h-10">
              <PencilIcon /> Editar
            </Button>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="h-10 text-destructive hover:text-destructive" disabled={removing}>
              {removing ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />} Remover
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover “{account.label}”?</AlertDialogTitle>
              <AlertDialogDescription>
                O {meta.noun} para de receber eventos e o segredo salvo é apagado. Isso não pode ser desfeito.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="h-11 bg-destructive text-white hover:bg-destructive/90"
                onClick={() =>
                  startRemove(async () => {
                    const result = await deleteAccount(account.kind, account.id);
                    if (result.ok) toast.success(result.message);
                    else toast.error(result.error);
                  })
                }
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </GlassCard>
  );
}
