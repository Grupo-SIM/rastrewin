"use client";

import { InfoIcon, LoaderCircleIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { changeOwnPassword, resetUserPassword } from "@/app/painel/usuarios/actions";
import { Field } from "@/components/config/field";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { UserRow } from "@/lib/users/data";
import { NewPasswordField } from "./password-field";

/** Redefinir a senha de outra pessoa, ou trocar a própria (pede a atual). */
export function PasswordDialog({
	open,
	onOpenChange,
	user,
	isSelf,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: UserRow;
	isSelf: boolean;
}) {
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, startTransition] = useTransition();
	const prefix = `pw-${user.id}`;

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		startTransition(async () => {
			const result = isSelf
				? await changeOwnPassword({
						currentPassword: String(form.get("currentPassword") ?? ""),
						newPassword: password,
					})
				: await resetUserPassword({ id: user.id, password });
			if (!result.ok) {
				const fe = result.fieldErrors ?? {};
				setErrors(isSelf && fe.newPassword ? { ...fe, password: fe.newPassword } : fe);
				toast.error(result.error);
				return;
			}
			setErrors({});
			onOpenChange(false);
			toast.success(result.message);
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{isSelf ? "Trocar minha senha" : "Redefinir senha"}</DialogTitle>
					<DialogDescription>
						{user.name} · {user.email}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{isSelf && (
						<Field id={`${prefix}-current`} label="Senha atual" error={errors.currentPassword}>
							<Input
								id={`${prefix}-current`}
								name="currentPassword"
								type="password"
								autoComplete="current-password"
								placeholder="Sua senha atual"
								className="h-11"
								aria-invalid={!!errors.currentPassword}
							/>
						</Field>
					)}
					<NewPasswordField
						id={`${prefix}-new`}
						label="Nova senha"
						value={password}
						onChange={setPassword}
						error={errors.password}
					/>
					<p className="bg-muted text-muted-foreground flex gap-2 rounded-lg px-3 py-2 text-xs">
						<InfoIcon className="text-cyan mt-0.5 size-3.5 shrink-0" aria-hidden />
						{isSelf
							? "Seus outros aparelhos são desconectados."
							: "A pessoa é desconectada de todos os aparelhos e passa a entrar com a nova senha. Envie a senha por um canal seguro."}
					</p>
					<DialogFooter className="gap-2">
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" className="h-11" disabled={pending}>
							{pending && <LoaderCircleIcon className="animate-spin" />}
							Salvar senha
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
