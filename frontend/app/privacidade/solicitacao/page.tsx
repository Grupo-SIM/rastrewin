"use client";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

// PERSONALIZAR: canal do encarregado de dados (o mesmo da política de privacidade).
const CONTACT_EMAIL = "contatosimintermediacoes@gmail.com";

type Kind = "ACCESS" | "DELETE";

/** Pedido de acesso ou exclusão dos dados (LGPD art. 18). A confirmação é pelo link enviado ao e-mail. */
export default function PrivacyRequestPage() {
	const [kind, setKind] = useState<Kind>("ACCESS");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [agree, setAgree] = useState(false);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const [sentTo, setSentTo] = useState("");

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (kind === "DELETE" && !agree) return setErr("Confirme que entendeu o que a exclusão faz.");
		setBusy(true);
		setErr("");
		try {
			await api("/privacy/requests", {
				body: JSON.stringify({ email: email.trim(), phone: phone.trim() || undefined, type: kind }),
				method: "POST",
			});
			setSentTo(email.trim());
		} catch (error) {
			setErr(
				String(error).includes("429")
					? "Muitos pedidos seguidos. Tente de novo em alguns minutos."
					: "Não foi possível enviar agora. Confira o e-mail e tente de novo.",
			);
		}
		setBusy(false);
	}

	return (
		<div className="auth-page">
			<div className="auth-frame">
				<nav className="nav">
					<a href="/">
						<Logo />
					</a>
					<a
						href="/privacidade"
						className="nav-hide"
						style={{ color: "var(--txt-2)", font: "500 15.5px var(--f-body)", paddingRight: 16 }}
					>
						Política de privacidade
					</a>
				</nav>
				<main className="auth-main">
					<div className="priv-box">
						<h1 className="display priv-title">
							Seus <span className="accent">dados</span>
						</h1>
						{sentTo ? (
							<div className="priv-card" role="status">
								<p>
									Enviamos um link para <b>{sentTo}</b>. Abra o e-mail e confirme o pedido
									na página do link. Ele vale por 30 minutos e só funciona uma vez.
								</p>
								<p className="priv-muted">
									Não chegou? Confira o spam. Por segurança, só mandamos um novo link para o
									mesmo e-mail depois de alguns minutos.
								</p>
							</div>
						) : (
							<form onSubmit={submit} className="priv-card" noValidate>
								<p>
									Peça para ver ou excluir os dados que a Rastrewin guarda sobre você (Lei
									13.709/2018, LGPD). Para confirmar que o pedido é seu, enviamos um link ao
									e-mail informado.
								</p>
								<fieldset className="priv-choices">
									<legend className="priv-label">O que você quer fazer?</legend>
									<label className={`priv-choice${kind === "ACCESS" ? " on" : ""}`}>
										<input
											type="radio"
											name="kind"
											checked={kind === "ACCESS"}
											onChange={() => {
												setKind("ACCESS");
												setErr("");
											}}
										/>
										<span>
											<b>Ver meus dados</b>
											<small>
												Cadastro, navegação, compras e escolhas de cookies, com
												download em arquivo.
											</small>
										</span>
									</label>
									<label className={`priv-choice${kind === "DELETE" ? " on" : ""}`}>
										<input
											type="radio"
											name="kind"
											checked={kind === "DELETE"}
											onChange={() => {
												setKind("DELETE");
												setErr("");
											}}
										/>
										<span>
											<b>Excluir meus dados</b>
											<small>
												Apaga o cadastro e o histórico de navegação e encerra o acesso
												à plataforma.
											</small>
										</span>
									</label>
								</fieldset>
								<label className="priv-label" htmlFor="priv-email">
									E-mail
								</label>
								<input
									id="priv-email"
									className="priv-input"
									type="email"
									required
									autoComplete="email"
									value={email}
									onChange={e => setEmail(e.target.value)}
								/>
								<label className="priv-label" htmlFor="priv-phone">
									Telefone <span className="priv-muted">(opcional)</span>
								</label>
								<input
									id="priv-phone"
									className="priv-input"
									type="tel"
									autoComplete="tel"
									value={phone}
									onChange={e => setPhone(e.target.value)}
								/>
								<p className="priv-muted">
									O telefone só é usado se for o mesmo do cadastro desse e-mail. Se você só
									tem o telefone, escreva para{" "}
									<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
								</p>
								{kind === "DELETE" && (
									<label className="priv-agree">
										<input
											type="checkbox"
											checked={agree}
											onChange={e => {
												setAgree(e.target.checked);
												setErr("");
											}}
										/>
										<span>
											Entendo que a exclusão apaga meu cadastro e encerra meu acesso,
											inclusive de um plano pago. Pedido, valor e data das compras ficam
											guardados sem me identificar, por obrigação fiscal.
										</span>
									</label>
								)}
								{err && <div className="err">{err}</div>}
								<button className="btn-dark" disabled={busy || !email.trim()}>
									{busy ? "Enviando..." : "Enviar link de confirmação"}
								</button>
							</form>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
