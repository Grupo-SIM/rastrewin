"use client";

import { KeyRoundIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { generateWebhookSecret, setWebhookSecret } from "@/app/painel/config/actions";
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
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { GeneralView } from "@/lib/config/types";
import { formatDateTime } from "@/lib/time";
import { CopyButton } from "./copy-button";
import { Field } from "./field";
import { SecretInput } from "./secret-input";

export function WebhookCard({ general }: { general: GeneralView }) {
	const [pending, startTransition] = useTransition();
	const [revealed, setRevealed] = useState<string | null>(null);
	const [manualOpen, setManualOpen] = useState(false);
	const [manualError, setManualError] = useState<string>();
	const configured = Boolean(general.webhookTokenHint);

	function generate() {
		startTransition(async () => {
			const result = await generateWebhookSecret();
			if (!result.ok) return void toast.error(result.error);
			setRevealed(result.data!.secret);
		});
	}

	function saveManual(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = String(new FormData(event.currentTarget).get("secret") ?? "");
		startTransition(async () => {
			const result = await setWebhookSecret(value);
			if (!result.ok) return void setManualError(result.error);
			setManualError(undefined);
			setManualOpen(false);
			toast.success(result.message);
		});
	}

	const generateButton = (
		<Button className="h-11" disabled={pending} onClick={configured ? undefined : generate}>
			{pending ? (
				<LoaderCircleIcon className="animate-spin" />
			) : configured ? (
				<RefreshCwIcon />
			) : (
				<KeyRoundIcon />
			)}
			{configured ? "Gerar novo segredo" : "Gerar segredo"}
		</Button>
	);

	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="font-semibold">Webhook de vendas</CardTitle>
				<CardDescription>
					O SimIntPay avisa a venda ao backend do rastrewin, que libera o plano e repassa o evento
					para cá, assinado (HMAC-SHA256 no header{" "}
					<code className="text-xs">x-simintpay-signature</code>). Só aceitamos envios assinados com
					este segredo.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<Field id="webhook-url" label="URL do webhook (TRACK_WEBHOOK_URL no backend do rastrewin)">
					<div className="flex gap-2">
						<code
							id="webhook-url"
							className="num bg-muted/40 flex h-11 min-w-0 flex-1 items-center overflow-x-auto rounded-lg border px-3 text-xs whitespace-nowrap"
						>
							{general.webhookUrl}
						</code>
						<CopyButton value={general.webhookUrl} className="h-11" />
					</div>
				</Field>

				<div className="flex flex-col gap-2">
					<span className="text-sm font-medium">
						Segredo (TRACK_WEBHOOK_SECRET no backend do rastrewin)
					</span>
					{configured ? (
						<p className="text-sm">
							Configurado: <span className="num">{general.webhookTokenHint}</span>
						</p>
					) : (
						<p className="text-amber flex items-center gap-2 text-sm">
							<TriangleAlertIcon className="size-4" /> Ainda não configurado. Vendas serão
							recusadas até definir.
						</p>
					)}
				</div>

				<div className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
					<span className="font-medium">Último evento recebido</span>
					{general.lastWebhook ? (
						<span className="text-muted-foreground">
							<span className="num text-foreground">{general.lastWebhook.eventType}</span>
							{general.lastWebhook.orderId && (
								<>
									{" "}
									· pedido <span className="num">{general.lastWebhook.orderId}</span>
								</>
							)}{" "}
							· {formatDateTime(general.lastWebhook.receivedAt, general.timezone)} ·{" "}
							{general.lastWebhook.error ? (
								<span className="text-destructive">erro: {general.lastWebhook.error}</span>
							) : general.lastWebhook.processed ? (
								<span className="text-primary">processado</span>
							) : (
								<span className="text-amber">pendente</span>
							)}
						</span>
					) : (
						<span className="text-muted-foreground">Nenhuma venda recebida ainda.</span>
					)}
				</div>

				<div className="flex flex-col gap-2 sm:flex-row">
					{configured ? (
						<AlertDialog>
							<AlertDialogTrigger asChild>{generateButton}</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Gerar um novo segredo?</AlertDialogTitle>
									<AlertDialogDescription>
										O segredo atual para de funcionar na hora. As vendas só voltam a ser
										aceitas depois que você colar o novo segredo no backend do rastrewin.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
									<AlertDialogAction className="h-11" onClick={generate}>
										Gerar novo
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					) : (
						generateButton
					)}

					<Dialog open={manualOpen} onOpenChange={setManualOpen}>
						<DialogTrigger asChild>
							<Button variant="outline" className="h-11">
								Usar segredo que já existe
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>Colar segredo existente</DialogTitle>
								<DialogDescription>
									Use se o segredo já foi definido no backend do rastrewin. Ele fica cifrado
									e não poderá ser visto de novo.
								</DialogDescription>
							</DialogHeader>
							<form onSubmit={saveManual} className="flex flex-col gap-4" noValidate>
								<Field
									id="manual-secret"
									label="Segredo"
									hint="24+ caracteres, sem espaços."
									error={manualError}
								>
									<SecretInput id="manual-secret" name="secret" placeholder="Cole aqui" />
								</Field>
								<DialogFooter>
									<Button type="submit" className="h-11" disabled={pending}>
										{pending && <LoaderCircleIcon className="animate-spin" />}
										Salvar segredo
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</CardContent>

			{/* Segredo recém-gerado: mostrado UMA vez */}
			<Dialog open={revealed !== null} onOpenChange={open => !open && setRevealed(null)}>
				<DialogContent className="sm:max-w-lg" onInteractOutside={e => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>Copie o segredo agora</DialogTitle>
						<DialogDescription>
							Ele não será mostrado de novo. Cole no backend do rastrewin como{" "}
							<strong>TRACK_WEBHOOK_SECRET</strong>, junto com a URL do webhook em{" "}
							<strong>TRACK_WEBHOOK_URL</strong>.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2 sm:flex-row">
						<code className="num bg-muted/40 flex min-h-11 min-w-0 flex-1 items-center rounded-lg border px-3 py-2 text-xs break-all">
							{revealed}
						</code>
						{revealed && <CopyButton value={revealed} className="h-11" />}
					</div>
					<DialogFooter>
						<Button className="h-11" onClick={() => setRevealed(null)}>
							Já copiei
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</GlassCard>
	);
}
