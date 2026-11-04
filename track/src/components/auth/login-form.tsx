"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** Só aceita voltar para rotas internas do painel (evita open redirect). */
function safeNext(value: string | null) {
	return value && /^\/painel(\/[\w\-/]*)?$/.test(value) ? value : "/painel";
}

export function LoginForm() {
	const router = useRouter();
	const params = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		const form = new FormData(event.currentTarget);
		const { error } = await authClient.signIn.email({
			email: String(form.get("email") ?? ""),
			password: String(form.get("password") ?? ""),
		});
		setPending(false);
		if (error) {
			setError(
				error.status === 429
					? "Muitas tentativas. Aguarde um minuto e tente de novo."
					: "Email ou senha incorretos.",
			);
			return;
		}
		router.replace(safeNext(params.get("next")));
		router.refresh();
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
			<div className="flex flex-col gap-2">
				<Label htmlFor="email">Email</Label>
				<Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="password">Senha</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autoComplete="current-password"
					required
					className="h-11"
				/>
			</div>
			{error && (
				<p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
					{error}
				</p>
			)}
			<Button type="submit" className="h-11 text-sm" disabled={pending}>
				{pending && <LoaderCircleIcon className="animate-spin" />}
				Entrar
			</Button>
		</form>
	);
}
