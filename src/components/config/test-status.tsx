import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react";
import type { AccountView } from "@/lib/config/types";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/time";

const STYLES = {
  ok: { icon: CircleCheckIcon, className: "text-primary", label: "Conexão OK" },
  warning: { icon: CircleAlertIcon, className: "text-amber", label: "Atenção" },
  error: { icon: CircleXIcon, className: "text-destructive", label: "Falhou" },
} as const;

export function TestStatus({ account, timeZone }: { account: AccountView; timeZone: string }) {
  if (!account.lastTestStatus || !account.lastTestAt) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleDashedIcon className="size-3.5" /> Ainda não testada
      </p>
    );
  }
  const style = STYLES[account.lastTestStatus];
  const Icon = style.icon;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className={cn("flex items-center gap-1.5 font-medium", style.className)}>
        <Icon className="size-3.5" /> {style.label}
        <span className="font-normal text-muted-foreground">· {formatDateTime(account.lastTestAt, timeZone)}</span>
      </p>
      {account.lastTestMessage && <p className="text-muted-foreground">{account.lastTestMessage}</p>}
    </div>
  );
}
