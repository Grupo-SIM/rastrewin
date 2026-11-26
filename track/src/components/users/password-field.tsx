"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD } from "@/lib/users/rules";

const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 16 caracteres sem os ambíguos (0/O, 1/l/I), em blocos de 4: "aB3d-Ef4g-…". */
export function strongPassword() {
	const max = 256 - (256 % CHARS.length); // descarta o viés do módulo
	const out: string[] = [];
	while (out.length < 16) {
		for (const n of crypto.getRandomValues(new Uint8Array(32))) {
			if (n < max && out.length < 16) out.push(CHARS[n % CHARS.length]);
		}
	}
	return out.join("").replace(/(.{4})(?=.)/g, "$1-");
}

/**
 * Senha NOVA definida pelo administrador: fica visível (é ele quem passa para a pessoa),
 * com "Copiar" e "Gerar senha forte". Sem mostrar/ocultar (decisão do mockup aprovado).
 */
export function NewPasswordField({
	id,
	label,
	value,
	onChange,
	error,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
}) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const input = useRef<HTMLInputElement>(null);

	async function copy() {
		if (!value) {
			toast.error("Digite ou gere uma senha primeiro.");
			input.current?.focus();
			return;
		}
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			input.current?.select();
			document.execCommand("copy");
		}
		setCopied(true);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(false), 1800);
		toast.success("Senha copiada.");
	}

	// O link "Gerar senha forte" fica visível mesmo com erro (o Field comum troca a dica pelo erro).
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex gap-2">
				<Input
					ref={input}
					id={id}
					name={id}
					type="text"
					value={value}
					onChange={event => onChange(event.target.value)}
					autoComplete="off"
					spellCheck={false}
					placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
					className="h-11 min-w-0 flex-1 font-mono text-sm"
					aria-invalid={!!error}
					aria-describedby={error ? `${id}-error` : undefined}
				/>
				<Button type="button" variant="outline" className="h-11 shrink-0" onClick={copy}>
					{copied ? <CheckIcon /> : <CopyIcon />}
					{copied ? "Copiada" : "Copiar"}
				</Button>
			</div>
			<p className="text-muted-foreground text-xs">
				Use pelo menos {MIN_PASSWORD} caracteres.{" "}
				<button
					type="button"
					className="text-cyan font-semibold hover:underline"
					onClick={() => onChange(strongPassword())}
				>
					Gerar senha forte
				</button>
			</p>
			{error && (
				<p id={`${id}-error`} className="text-destructive text-xs">
					{error}
				</p>
			)}
		</div>
	);
}
