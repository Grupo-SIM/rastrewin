import {
	CircleAlertIcon,
	CircleCheckIcon,
	CircleDashedIcon,
	CircleXIcon,
	ClockIcon,
	Undo2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Status SEMPRE com ícone + rótulo (nunca só cor). Cores de status reservadas. */
const PURCHASE: Record<string, { label: string; icon: typeof CircleCheckIcon; color: string }> = {
	approved: { color: "var(--status-good)", icon: CircleCheckIcon, label: "Aprovada" },
	chargeback: { color: "var(--status-critical)", icon: CircleXIcon, label: "Chargeback" },
	declined: { color: "var(--muted-foreground)", icon: CircleXIcon, label: "Recusada" },
	expired: { color: "var(--muted-foreground)", icon: CircleDashedIcon, label: "Expirada" },
	pending: { color: "var(--muted-foreground)", icon: ClockIcon, label: "Pendente" },
	refund_requested: { color: "var(--status-warning)", icon: CircleAlertIcon, label: "Em mediação" },
	refunded: { color: "var(--status-serious)", icon: Undo2Icon, label: "Reembolsada" },
};

const DELIVERY: Record<string, { label: string; icon: typeof CircleCheckIcon; color: string }> = {
	erro: { color: "var(--status-critical)", icon: CircleXIcon, label: "Erro" },
	expirado: { color: "var(--muted-foreground)", icon: ClockIcon, label: "Expirado" },
	ok: { color: "var(--status-good)", icon: CircleCheckIcon, label: "Enviado" },
	pendente: { color: "var(--muted-foreground)", icon: CircleDashedIcon, label: "Sem envio" },
};

function Badge({
	spec,
	className,
}: {
	spec: { label: string; icon: typeof CircleCheckIcon; color: string };
	className?: string;
}) {
	const Icon = spec.icon;
	return (
		<span
			className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", className)}
		>
			<Icon className="size-3.5 shrink-0" style={{ color: spec.color }} aria-hidden />
			{spec.label}
		</span>
	);
}

export function PurchaseStatus({ status, className }: { status: string; className?: string }) {
	return (
		<Badge
			spec={
				PURCHASE[status] ?? {
					color: "var(--muted-foreground)",
					icon: CircleDashedIcon,
					label: status,
				}
			}
			className={className}
		/>
	);
}

export function DeliveryStatus({ status, className }: { status: string; className?: string }) {
	return <Badge spec={DELIVERY[status] ?? DELIVERY.pendente} className={className} />;
}

export const PURCHASE_STATUS_LABEL = Object.fromEntries(
	Object.entries(PURCHASE).map(([k, v]) => [k, v.label]),
);
