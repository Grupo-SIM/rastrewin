"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, TOKEN_KEY, type User } from "@/lib/api";

export default function Login() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	// Só aparece para quem ativou o 2FA (o admin): o backend responde pedindo o código.
	const [totp, setTotp] = useState("");
	const [needTotp, setNeedTotp] = useState(false);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setErr("");
		try {
			const { token, user } = await api<{ token: string; user: User }>("/auth/login", {
				body: JSON.stringify({ email, password, ...(needTotp ? { totp } : {}) }),
				method: "POST",
			});
			localStorage.removeItem("userId"); // chave da versão antiga
			localStorage.setItem(TOKEN_KEY, token);
			router.push("/dashboard");
		} catch (e) {
			// 429 = muitas tentativas em pouco tempo (limite do backend); o resto é e-mail ou senha errados.
			const msg = e instanceof Error ? e.message : "";
			const tooMany = msg.startsWith("429");
			if (msg.includes("totpRequired")) {
				setNeedTotp(true);
				setErr(needTotp ? "Código do autenticador inválido." : "");
				setBusy(false);
				return;
			}
			setErr(
				tooMany
					? "Muitas tentativas. Aguarde um minuto e tente de novo."
					: "E-mail ou senha inválidos.",
			);
			setBusy(false);
		}
	}

	return (
		<div className="auth-page">
			<div className="auth-frame">
				<nav className="nav">
					<a href="/">
						<Logo />
					</a>
					<a
						href="/#planos"
						className="nav-hide"
						style={{ color: "var(--txt-2)", font: "500 15.5px var(--f-body)", paddingRight: 16 }}
					>
						Ainda não sou cliente
					</a>
				</nav>
				<main className="auth-main">
					<div className="auth-box">
						<h1 className="display">
							<span className="accent" style={{ fontSize: "1.14em" }}>
								Entrar
							</span>
						</h1>
						<form
							onSubmit={submit}
							style={{ display: "grid", gap: 16, justifyItems: "stretch", width: "100%" }}
						>
							<label className="auth-mobile-label" htmlFor="email">
								E-mail cadastrado
							</label>
							<div className="auth-input">
								<input
									id="email"
									type="email"
									required
									placeholder="E-mail cadastrado"
									value={email}
									onChange={e => setEmail(e.target.value)}
								/>
							</div>
							<label className="auth-mobile-label" htmlFor="password">
								Senha
							</label>
							<div className="auth-input">
								<input
									id="password"
									type="password"
									required
									placeholder="Senha"
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
								{!needTotp && (
									<button className="btn-dark" disabled={busy}>
										{busy ? "Entrando..." : "Entrar"}
									</button>
								)}
							</div>
							{needTotp && (
								<>
									<label className="auth-mobile-label" htmlFor="totp">
										Código do autenticador
									</label>
									<div className="auth-input">
										<input
											id="totp"
											type="text"
											inputMode="numeric"
											autoComplete="one-time-code"
											// biome-ignore lint/a11y/noAutofocus: o campo só surge depois que o servidor pede o código; o foco vai para o que acabou de aparecer
											autoFocus
											required
											pattern="\d{6}"
											maxLength={6}
											placeholder="Código de 6 dígitos"
											value={totp}
											onChange={e => setTotp(e.target.value.replace(/\D/g, ""))}
										/>
										<button className="btn-dark" disabled={busy}>
											{busy ? "Entrando..." : "Entrar"}
										</button>
									</div>
								</>
							)}
							{err && <div className="err">{err}</div>}
						</form>
						<a href="/esqueci-senha" className="auth-link">
							Esqueci minha senha
						</a>
						<a href="/#planos" className="auth-link">
							Ainda não sou cliente
						</a>
					</div>
				</main>
			</div>
		</div>
	);
}
