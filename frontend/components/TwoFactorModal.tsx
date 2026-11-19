"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const field: React.CSSProperties = {
	background: "#fff",
	border: 0,
	borderRadius: 999,
	boxShadow: "0 0 0 1px rgba(0,0,0,.12)",
	color: "var(--ink)",
	font: "500 16px var(--f-body)",
	height: 52,
	outline: "none",
	padding: "0 20px",
	width: "100%",
};

/** Liga o 2FA (app autenticador) da conta admin. Depois de ligado, o login passa a pedir o código. */
export function TwoFactorModal({ onClose }: { onClose: () => void }) {
	const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const [done, setDone] = useState(false);

	async function start() {
		setBusy(true);
		setErr("");
		try {
			setSecret(await api("/auth/totp/setup", { method: "POST" }));
		} catch (e) {
			setErr((e as Error).message.includes("já está ativo") ? "O 2FA já está ativo." : "Não foi possível iniciar.");
		}
		setBusy(false);
	}

	async function enable(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setErr("");
		try {
			await api("/auth/totp/enable", { body: JSON.stringify({ code }), method: "POST" });
			setDone(true);
		} catch {
			setErr("Código inválido. Confira o horário do celular e tente de novo.");
		}
		setBusy(false);
	}

	return (
		<div
			onClick={onClose}
			style={{
				background: "rgba(10,12,20,.72)",
				display: "grid",
				inset: 0,
				padding: 20,
				placeItems: "center",
				position: "fixed",
				zIndex: 1000,
			}}
		>
			<div
				onClick={e => e.stopPropagation()}
				style={{
					background: "#fff",
					borderRadius: 20,
					display: "grid",
					gap: 16,
					maxWidth: 460,
					padding: 32,
					width: "100%",
				}}
			>
				<h2 className="display" style={{ fontSize: 24, textAlign: "center" }}>
					Verificação em duas etapas
				</h2>
				{done ? (
					<>
						<p style={{ color: "var(--mut)", fontSize: 15, textAlign: "center" }}>
							Pronto. Nos próximos logins, além da senha, será pedido o código do app autenticador.
						</p>
						<button className="btn-dark" onClick={onClose}>
							Fechar
						</button>
					</>
				) : !secret ? (
					<>
						<p style={{ color: "var(--mut)", fontSize: 15 }}>
							Esta conta vê o CPF e o Pix de todos os clientes. Com o 2FA, só a senha não basta para entrar.
							Você vai precisar de um app autenticador (Google Authenticator, Authy, 1Password...).
						</p>
						{err && <div className="err">{err}</div>}
						<button className="btn-dark" disabled={busy} onClick={start}>
							{busy ? "Gerando..." : "Começar"}
						</button>
						<button type="button" className="btn-outline" onClick={onClose}>
							Cancelar
						</button>
					</>
				) : (
					<form onSubmit={enable} style={{ display: "grid", gap: 12 }}>
						<p style={{ color: "var(--mut)", fontSize: 15 }}>
							No app, adicione uma conta digitando esta chave (tipo "baseado em tempo"):
						</p>
						<code
							style={{
								background: "#f3f5f8",
								borderRadius: 12,
								fontSize: 17,
								letterSpacing: ".08em",
								overflowWrap: "anywhere",
								padding: "12px 14px",
								userSelect: "all",
							}}
						>
							{secret.secret}
						</code>
						<a href={secret.otpauthUrl} className="lnk" style={{ fontSize: 14 }}>
							Abrir direto no app autenticador do celular
						</a>
						<input
							style={field}
							inputMode="numeric"
							autoComplete="one-time-code"
							required
							pattern="\d{6}"
							maxLength={6}
							placeholder="Código de 6 dígitos"
							value={code}
							onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
						/>
						{err && <div className="err">{err}</div>}
						<button className="btn-dark" disabled={busy}>
							{busy ? "Confirmando..." : "Ativar"}
						</button>
						<button type="button" className="btn-outline" onClick={onClose}>
							Cancelar
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
