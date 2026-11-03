import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon, ClockIcon, Undo2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Status SEMPRE com ícone + rótulo (nunca só cor). Cores de status reservadas. */
const PURCHASE: Record<string, { label: string; icon: typeof CircleCheckIcon; color: string }> = {
  approved: { label: "Aprovada", icon: CircleCheckIcon, color: "var(--status-good)" },
  refund_requested: { label: "Em mediação", icon: CircleAlertIcon, color: "var(--status-warning)" },
  refunded: { label: "Reembolsada", icon: Undo2Icon, color: "var(--status-serious)" },
  chargeback: { label: "Chargeback", icon: CircleXIcon, color: "var(--status-critical)" },
  pending: { label: "Pendente", icon: ClockIcon, color: "var(--muted-foreground)" },
  declined: { label: "Recusada", icon: CircleXIcon, color: "var(--muted-foreground)" },
  expired: { label: "Expirada", icon: CircleDashedIcon, color: "var(--muted-foreground)" },
};

const DELIVERY: Record<string, { label: string; icon: typeof CircleCheckIcon; color: string }> = {
  ok: { label: "Enviado", icon: CircleCheckIcon, color: "var(--status-good)" },
  erro: { label: "Erro", icon: CircleXIcon, color: "var(--status-critical)" },
  pendente: { label: "Sem envio", icon: CircleDashedIcon, color: "var(--muted-foreground)" },
  expirado: { label: "Expirado", icon: ClockIcon, color: "var(--muted-foreground)" },
};

function Badge({ spec, className }: { spec: { label: string; icon: typeof CircleCheckIcon; color: string }; className?: string }) {
  const Icon = spec.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", className)}>
      <Icon className="size-3.5 shrink-0" style={{ color: spec.color }} aria-hidden />
      {spec.label}
    </span>
  );
}

export function PurchaseStatus({ status, className }: { status: string; className?: string }) {
  return <Badge spec={PURCHASE[status] ?? { label: status, icon: CircleDashedIcon, color: "var(--muted-foreground)" }} className={className} />;
}

export function DeliveryStatus({ status, className }: { status: string; className?: string }) {
  return <Badge spec={DELIVERY[status] ?? DELIVERY.pendente} className={className} />;
}

export const PURCHASE_STATUS_LABEL = Object.fromEntries(Object.entries(PURCHASE).map(([k, v]) => [k, v.label]));
