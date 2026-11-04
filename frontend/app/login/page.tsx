"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, type User } from "@/lib/api";

export default function Login() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setErr("");
		try {
			const { token, user } = await api<{ token: string; user: User }>("/auth/login", {
				body: JSON.stringify({ email, password }),
				method: "POST",
			});
			localStorage.setItem("userToken", token);
			localStorage.setItem("userId", user.id);
			router.push("/dashboard");
		} catch {
			setErr("E-mail ou senha inválidos.");
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
								<button className="btn-dark" disabled={busy}>
									{busy ? "Entrando..." : "Entrar"}
								</button>
							</div>
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
