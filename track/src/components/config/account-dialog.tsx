"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAccount } from "@/app/painel/config/actions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AccountView } from "@/lib/config/types";
import type { AccountKind } from "@/lib/config/validation";
import { Field } from "./field";
import { KIND_META } from "./kinds";
import { SecretInput } from "./secret-input";

export function AccountDialog({
	kind,
	account,
	trigger,
}: {
	kind: AccountKind;
	account?: AccountView;
	trigger: ReactNode;
}) {
	const meta = KIND_META[kind];
	const [open, setOpen] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [active, setActive] = useState(account?.active ?? true);
	const [pending, startTransition] = useTransition();
	const editing = Boolean(account);
	const prefix = `${kind}-${account?.id ?? "new"}`;

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		startTransition(async () => {
			const result = await saveAccount(kind, {
				active,
				externalId: String(form.get("externalId") ?? ""),
				id: account?.id,
				label: String(form.get("label") ?? ""),
				secret: String(form.get("secret") ?? ""),
			});
			if (!result.ok) {
				setErrors(result.fieldErrors ?? {});
				toast.error(result.error);
				return;
			}
			setErrors({});
			setOpen(false);
			toast.success(result.message);
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={value => {
				setOpen(value);
				if (value) {
					setErrors({});
					setActive(account?.active ?? true);
				}
			}}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{editing ? `Editar ${meta.noun}` : `Adicionar ${meta.noun}`}</DialogTitle>
					<DialogDescription>{meta.description}</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					<Field
						id={`${prefix}-label`}
						label="Nome"
						hint="Só para você identificar. Ex.: Loja principal"
						error={errors.label}
					>
						<Input
							id={`${prefix}-label`}
							name="label"
							defaultValue={account?.label}
							maxLength={60}
							required
							className="h-11"
							aria-invalid={!!errors.label}
						/>
					</Field>
					<Field id={`${prefix}-ext`} label={meta.externalLabel} error={errors.externalId}>
						<Input
							id={`${prefix}-ext`}
							name="externalId"
							defaultValue={account?.externalId}
							placeholder={meta.externalPlaceholder}
							required
							className="h-11 font-mono text-sm"
							autoComplete="off"
							spellCheck={false}
							aria-invalid={!!errors.externalId}
						/>
					</Field>
					<Field
						id={`${prefix}-secret`}
						label={meta.secretLabel}
						hint={
							editing
								? `Deixe em branco para manter o atual (${account?.secretHint}).`
								: meta.help
						}
						error={errors.secret}
					>
						<SecretInput
							id={`${prefix}-secret`}
							name="secret"
							placeholder={editing ? "Em branco = manter o atual" : "Cole aqui"}
							aria-invalid={!!errors.secret}
						/>
					</Field>
					{editing && <p className="text-muted-foreground -mt-2 text-xs">{meta.help}</p>}
					<div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
						<div>
							<Label htmlFor={`${prefix}-active`}>Ativa</Label>
							<p className="text-muted-foreground text-xs">
								Contas inativas não recebem eventos.
							</p>
						</div>
						<Switch id={`${prefix}-active`} checked={active} onCheckedChange={setActive} />
					</div>
					<DialogFooter className="gap-2">
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setOpen(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" className="h-11" disabled={pending}>
							{pending && <LoaderCircleIcon className="animate-spin" />}
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
