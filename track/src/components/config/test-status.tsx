import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react";
import type { AccountView } from "@/lib/config/types";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const STYLES = {
	error: { className: "text-destructive", icon: CircleXIcon, label: "Falhou" },
	ok: { className: "text-primary", icon: CircleCheckIcon, label: "Conexão OK" },
	warning: { className: "text-amber", icon: CircleAlertIcon, label: "Atenção" },
} as const;

export function TestStatus({ account, timeZone }: { account: AccountView; timeZone: string }) {
	if (!account.lastTestStatus || !account.lastTestAt) {
		return (
			<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
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
				<span className="text-muted-foreground font-normal">
					· {formatDateTime(account.lastTestAt, timeZone)}
				</span>
			</p>
			{account.lastTestMessage && <p className="text-muted-foreground">{account.lastTestMessage}</p>}
		</div>
	);
}
