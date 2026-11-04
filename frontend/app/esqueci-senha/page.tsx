"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

type Step = "email" | "code" | "password" | "done";
const RESEND_SECONDS = 60;

export default function ForgotPassword() {
	const router = useRouter();
	const [step, setStep] = useState<Step>("email");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const [wait, setWait] = useState(0);

	useEffect(() => {
		if (wait <= 0) return;
		const t = setTimeout(() => setWait(w => w - 1), 1000);
		return () => clearTimeout(t);
	}, [wait]);

	useEffect(() => {
		if (step !== "done") return;
		const t = setTimeout(() => router.push("/login"), 2500);
		return () => clearTimeout(t);
	}, [step, router]);

	async function post(path: string, body: object) {
		return api(path, { body: JSON.stringify(body), method: "POST" });
	}

	async function sendEmail(e?: React.FormEvent) {
		e?.preventDefault();
		setBusy(true);
		setErr("");
		try {
			await post("/auth/forgot-password", { email: email.trim() });
			setWait(RESEND_SECONDS);
			setStep("code");
		} catch {
			setErr("Não foi possível enviar o código. Confira o e-mail e tente de novo.");
		}
		setBusy(false);
	}

	async function resend() {
		setCode("");
		await sendEmail();
	}

	async function verifyCode(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setErr("");
		try {
			await post("/auth/verify-reset-code", { code, email: email.trim() });
			setStep("password");
		} catch {
			setErr("Código inválido ou expirado.");
		}
		setBusy(false);
	}

	async function resetPassword(e: React.FormEvent) {
		e.preventDefault();
		setErr("");
		if (password.length < 8) return setErr("A senha deve ter pelo menos 8 caracteres.");
		if (password !== confirm) return setErr("As senhas não coincidem.");
		setBusy(true);
		try {
			await post("/auth/reset-password", { code, email: email.trim(), password });
			setStep("done");
		} catch {
			setErr("Código inválido ou expirado. Volte e peça um novo código.");
		}
		setBusy(false);
	}

	const title = {
		code: "Digite o código",
		done: "Senha alterada",
		email: "Esqueci a senha",
		password: "Nova senha",
	}[step];

	return (
		<div className="auth-page">
			<div className="auth-frame">
				<nav className="nav">
					<a href="/">
						<Logo />
					</a>
					<a
						href="/login"
						className="nav-hide"
						style={{ color: "var(--txt-2)", font: "500 15.5px var(--f-body)", paddingRight: 16 }}
					>
						Voltar ao login
					</a>
				</nav>
				<main className="auth-main">
					<div className="auth-box">
						<h1 className="display">
							<span className="accent" style={{ fontSize: "1.14em" }}>
								{title}
							</span>
						</h1>

						{step === "email" && (
							<form
								onSubmit={sendEmail}
								style={{ display: "grid", gap: 16, justifyItems: "stretch", width: "100%" }}
							>
								<p style={{ color: "var(--mut)", fontSize: 16 }}>
									Informe o e-mail da sua conta e enviaremos um código de confirmação.
								</p>
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
									<button className="btn-dark" disabled={busy}>
										{busy ? "Enviando..." : "Enviar código"}
									</button>
								</div>
								{err && <div className="err">{err}</div>}
							</form>
						)}

						{step === "code" && (
							<form
								onSubmit={verifyCode}
								style={{ display: "grid", gap: 16, justifyItems: "stretch", width: "100%" }}
							>
								<p style={{ color: "var(--mut)", fontSize: 16 }}>
									Se o e-mail <b>{email}</b> tiver conta, enviamos um código de 6 dígitos.
									Ele vale por 15 minutos.
								</p>
								<label className="auth-mobile-label" htmlFor="code">
									Código de confirmação
								</label>
								<div className="auth-input">
									<input
										id="code"
										inputMode="numeric"
										autoComplete="one-time-code"
										required
										maxLength={6}
										placeholder="000000"
										value={code}
										onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
										style={{ letterSpacing: ".3em" }}
									/>
									<button className="btn-dark" disabled={busy || code.length !== 6}>
										{busy ? "Verificando..." : "Confirmar"}
									</button>
								</div>
								{err && <div className="err">{err}</div>}
								<button
									type="button"
									className="auth-link"
									disabled={wait > 0 || busy}
									onClick={resend}
									style={{
										background: "none",
										border: 0,
										cursor: wait > 0 ? "default" : "pointer",
									}}
								>
									{wait > 0 ? `Reenviar código em ${wait}s` : "Reenviar código"}
								</button>
								<button
									type="button"
									className="auth-link"
									onClick={() => {
										setStep("email");
										setCode("");
										setErr("");
									}}
									style={{ background: "none", border: 0, cursor: "pointer" }}
								>
									Usar outro e-mail
								</button>
							</form>
						)}

						{step === "password" && (
							<form
								onSubmit={resetPassword}
								style={{ display: "grid", gap: 16, justifyItems: "stretch", width: "100%" }}
							>
								<label className="auth-mobile-label" htmlFor="password">
									Nova senha
								</label>
								<div className="auth-input">
									<input
										id="password"
										type="password"
										required
										minLength={8}
										maxLength={72}
										placeholder="Nova senha"
										value={password}
										onChange={e => setPassword(e.target.value)}
									/>
								</div>
								<label className="auth-mobile-label" htmlFor="confirm">
									Confirmar nova senha
								</label>
								<div className="auth-input">
									<input
										id="confirm"
										type="password"
										required
										minLength={8}
										maxLength={72}
										placeholder="Confirmar nova senha"
										value={confirm}
										onChange={e => setConfirm(e.target.value)}
									/>
									<button className="btn-dark" disabled={busy}>
										{busy ? "Salvando..." : "Salvar"}
									</button>
								</div>
								{err && <div className="err">{err}</div>}
							</form>
						)}

						{step === "done" && (
							<div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
								<p style={{ color: "var(--mut)", fontSize: 16 }}>
									Pronto! Sua senha foi alterada. Redirecionando para o login...
								</p>
								<a href="/login" className="btn-dark" style={{ textDecoration: "none" }}>
									Ir para o login
								</a>
							</div>
						)}

						{step !== "done" && (
							<a href="/login" className="auth-link">
								Voltar ao login
							</a>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
