"use client";

import { InfoIcon, LoaderCircleIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/app/painel/usuarios/actions";
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
import { DEFAULT_ROLE, type Role, ROLE_LABEL, ROLES } from "@/lib/roles";
import type { UserRow } from "@/lib/users/data";
import { cn } from "@/lib/utils";
import { NewPasswordField } from "./password-field";

/** Adicionar (user ausente) ou editar. Na própria conta (isSelf) só o nome muda. */
export function UserDialog({
	open,
	onOpenChange,
	user,
	isSelf = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user?: UserRow;
	isSelf?: boolean;
}) {
	const editing = Boolean(user);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [password, setPassword] = useState("");
	const [role, setRole] = useState<Role>(user?.role ?? DEFAULT_ROLE);
	const [pending, startTransition] = useTransition();
	const prefix = `user-${user?.id ?? "new"}`;

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const base = {
			email: isSelf ? (user?.email ?? "") : String(form.get("email") ?? ""),
			name: String(form.get("name") ?? ""),
			role,
		};
		startTransition(async () => {
			const result = user
				? await updateUser({ ...base, id: user.id })
				: await createUser({ ...base, password });
			if (!result.ok) {
				setErrors(result.fieldErrors ?? {});
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
					<DialogTitle>{editing ? "Editar usuário" : "Adicionar usuário"}</DialogTitle>
					<DialogDescription>
						{editing ? user?.email : "Você define a senha e passa para a pessoa."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					<Field id={`${prefix}-name`} label="Nome" error={errors.name}>
						<Input
							id={`${prefix}-name`}
							name="name"
							defaultValue={user?.name}
							placeholder="Nome completo"
							maxLength={100}
							autoComplete="off"
							className="h-11"
							aria-invalid={!!errors.name}
						/>
					</Field>
					<Field id={`${prefix}-email`} label="E-mail" error={errors.email}>
						<Input
							id={`${prefix}-email`}
							name="email"
							type="email"
							defaultValue={user?.email}
							placeholder="pessoa@empresa.com"
							maxLength={254}
							autoComplete="off"
							spellCheck={false}
							disabled={isSelf}
							className="h-11"
							aria-invalid={!!errors.email}
						/>
					</Field>
					{!editing && (
						<NewPasswordField
							id={`${prefix}-password`}
							label="Senha"
							value={password}
							onChange={value => {
								setPassword(value);
								setErrors(({ password: _, ...rest }) => rest);
							}}
							error={errors.password}
						/>
					)}
					<fieldset className="flex flex-col gap-2" disabled={isSelf}>
						<legend className="mb-2 text-sm font-medium">Nível de acesso</legend>
						{ROLES.map(value => (
							<label
								key={value}
								className={cn(
									"flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
									role === value && "border-primary/60 bg-primary/5",
									isSelf && "cursor-not-allowed opacity-60",
									"has-focus-visible:border-primary",
								)}
							>
								<input
									type="radio"
									name="role"
									value={value}
									checked={role === value}
									onChange={() => setRole(value)}
									className="accent-primary mt-0.5 size-4 shrink-0 self-start outline-none"
								/>
								<span className="flex flex-col">
									<span className="text-sm font-semibold">{ROLE_LABEL[value].name}</span>
									<span className="text-muted-foreground text-xs">
										{ROLE_LABEL[value].description}
									</span>
								</span>
							</label>
						))}
					</fieldset>
					{isSelf && (
						<p className="bg-muted text-muted-foreground flex gap-2 rounded-lg px-3 py-2 text-xs">
							<InfoIcon className="text-cyan mt-0.5 size-3.5 shrink-0" aria-hidden />
							Ninguém muda o próprio nível nem o próprio e-mail: assim o painel nunca fica sem
							administrador. Peça a outro administrador, se precisar.
						</p>
					)}
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
							{editing ? "Salvar alterações" : "Criar usuário"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
