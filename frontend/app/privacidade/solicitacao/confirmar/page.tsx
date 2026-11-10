"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

type Row = Record<string, unknown>;
interface AccessResult {
	tipo: "acesso";
	gerado_em: string;
	conta: Record<string, Row | unknown> | null;
	navegacao_e_compras: Record<string, Row[]>;
}
interface EraseResult {
	tipo: "exclusao";
	resumo: { conta: Record<string, number | boolean>; rastreamento: Record<string, number> };
}

/** Rótulos legíveis dos campos (o resto aparece com o nome técnico). */
const LABELS: Record<string, string> = {
	action: "escolha",
	assinatura: "Assinatura",
	at: "quando",
	cadastro: "Cadastro",
	// campos
	city: "cidade",
	consent_at: "aceite em",
	consent_marketing: "aceitou marketing",
	consents: "Escolhas de cookies",
	country: "país",
	currency: "moeda",
	email_hash_kept: "hash do e-mail guardado",
	event: "evento",
	events: "Eventos de navegação",
	first_seen_at: "primeira visita",
	google_client_id: "id do Google Analytics",
	ip: "IP",
	landing_url: "primeira página",
	last_seen_at: "última visita",
	marketing: "marketing aceito",
	meta_browser_id: "id do navegador (Meta)",
	meta_click_id: "id do clique no anúncio (Meta)",
	name_hash_kept: "hash do nome guardado",
	order_id: "pedido",
	origem_da_visita_no_cadastro: "Origem da visita no cadastro",
	origin: "site",
	page: "página",
	page_path: "página",
	participacoes: "participações",
	payment_method: "forma de pagamento",
	phone_hash_kept: "hash do telefone guardado",
	product: "produto",
	purchases: "Compras",
	reached_second: "chegou ao segundo",
	referrer: "veio de",
	region: "estado",
	sent_to_google: "enviada ao Google",
	sent_to_meta: "enviada à Meta",
	situacao: "situação",
	sorteios: "Sorteios",
	status: "situação",
	user_agent: "navegador",
	utm_campaign: "campanha",
	utm_content: "anúncio",
	utm_medium: "meio",
	utm_source: "origem",
	utm_term: "conjunto",
	value: "valor",
	version: "versão do texto",
	video: "vídeo",
	videos: "Vídeos assistidos",
	visitor_id: "id do visitante",
	visitors: "Identificadores de navegação",
	watched_seconds: "segundos assistidos",
};
const SECTIONS = ["visitors", "events", "videos", "purchases", "consents"];
const PREVIEW = 20;

const DATE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const text = (v: unknown): string => {
	if (v === null || v === undefined || v === "") return "—";
	if (typeof v === "boolean") return v ? "Sim" : "Não";
	if (typeof v === "string" && DATE.test(v)) {
		const d = new Date(v.replace(" ", "T").replace(/\+00$/, "Z"));
		if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR");
	}
	return typeof v === "object" ? JSON.stringify(v) : String(v);
};

function Table({ rows }: { rows: Row[] }) {
	const cols = Object.keys(rows[0] ?? {});
	return (
		<div className="priv-table-wrap">
			<table className="priv-table">
				<thead>
					<tr>
						{cols.map(c => (
							<th key={c}>{LABELS[c] ?? c}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.slice(0, PREVIEW).map((r, i) => (
						<tr key={i}>
							{cols.map(c => (
								<td key={c}>{text(r[c])}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function Access({ data }: { data: AccessResult }) {
	const download = () => {
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "meus-dados-rastrewin.json";
		a.click();
		URL.revokeObjectURL(a.href);
	};
	return (
		<div className="priv-card">
			<p>
				Estes são os dados que a Rastrewin guarda sobre você. O arquivo tem tudo; a página mostra até{" "}
				{PREVIEW} linhas de cada parte.
			</p>
			<button type="button" className="btn-dark" onClick={download}>
				Baixar meus dados (.json)
			</button>
			{data.conta ? (
				Object.entries(data.conta).map(([group, values]) => (
					<section key={group} className="priv-section">
						<h2>{LABELS[group] ?? group}</h2>
						{values && typeof values === "object" ? (
							<dl className="priv-dl">
								{Object.entries(values as Row).map(([k, v]) => (
									<div key={k}>
										<dt>{LABELS[k] ?? k.replaceAll("_", " ")}</dt>
										<dd>{text(v)}</dd>
									</div>
								))}
							</dl>
						) : (
							<p className="priv-muted">—</p>
						)}
					</section>
				))
			) : (
				<p className="priv-muted">Não há cadastro com este e-mail.</p>
			)}
			{SECTIONS.map(key => {
				const rows = data.navegacao_e_compras[key] ?? [];
				return (
					<section key={key} className="priv-section">
						<h2>
							{LABELS[key]} <span className="priv-muted">({rows.length})</span>
						</h2>
						{rows.length ? <Table rows={rows} /> : <p className="priv-muted">Nada registrado.</p>}
					</section>
				);
			})}
			<p className="priv-muted">
				Compartilhamos com a Meta e o Google só o que aparece como enviado nas compras e os eventos de
				navegação de quem aceitou os cookies de marketing (e-mail, telefone e nome sempre
				embaralhados). Detalhes na <a href="/privacidade">política de privacidade</a>.
			</p>
		</div>
	);
}

function Erased({ data }: { data: EraseResult }) {
	const t = data.resumo.rastreamento ?? {};
	const c = data.resumo.conta ?? {};
	return (
		<div className="priv-card" role="status">
			<p>
				<b>Pronto: seus dados foram excluídos.</b>
			</p>
			<ul className="priv-list">
				<li>
					{c.cadastro_anonimizado
						? "Cadastro anonimizado e acesso encerrado."
						: "Não havia cadastro com este e-mail."}
				</li>
				<li>
					Navegação: {t.visitors ?? 0} identificador(es) de visitante, {t.events ?? 0} evento(s) e{" "}
					{t.videos ?? 0} play(s) de vídeo apagados.
				</li>
				<li>
					{t.purchases ?? 0} compra(s) anonimizada(s): ficam só pedido, valor e data, sem
					identificar você (obrigação fiscal).
				</li>
			</ul>
			<p className="priv-muted">
				Dados que já tinham sido enviados ao Google Analytics são apagados por nós lá nos próximos
				dias. A Meta não permite apagar eventos que já recebeu; eles foram enviados com e-mail e
				telefone embaralhados.
			</p>
		</div>
	);
}

function Confirm() {
	const token = useSearchParams().get("token") ?? "";
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const [result, setResult] = useState<AccessResult | EraseResult | null>(null);

	async function confirm() {
		setBusy(true);
		setErr("");
		try {
			setResult(
				await api<AccessResult | EraseResult>("/privacy/requests/confirm", {
					body: JSON.stringify({ token }),
					method: "POST",
				}),
			);
		} catch (error) {
			const raw = String(error);
			const message = /"message":"([^"]+)"/.exec(raw)?.[1];
			setErr(message ?? "Não foi possível confirmar agora. Tente de novo em alguns minutos.");
		}
		setBusy(false);
	}

	if (result) return result.tipo === "acesso" ? <Access data={result} /> : <Erased data={result} />;
	return (
		<div className="priv-card">
			{token ? (
				<>
					<p>
						Confirme abaixo o pedido que você fez em{" "}
						<a href="/privacidade/solicitacao">rastrewin.com/privacidade/solicitacao</a>. Se for
						uma exclusão, ela acontece na hora e não pode ser desfeita.
					</p>
					{err && <div className="err">{err}</div>}
					<button type="button" className="btn-dark" disabled={busy} onClick={confirm}>
						{busy ? "Confirmando..." : "Confirmar pedido"}
					</button>
				</>
			) : (
				<p>
					Link incompleto. Abra o link do e-mail de novo ou{" "}
					<a href="/privacidade/solicitacao">faça um novo pedido</a>.
				</p>
			)}
		</div>
	);
}

/** Confirmação do pedido de privacidade. Nada acontece só por abrir o link: é preciso clicar em Confirmar
 * (programas de e-mail costumam abrir links sozinhos para checar segurança). */
export default function PrivacyConfirmPage() {
	return (
		<div className="auth-page">
			<div className="auth-frame">
				<nav className="nav">
					<a href="/">
						<Logo />
					</a>
				</nav>
				<main className="auth-main">
					<div className="priv-box">
						<h1 className="display priv-title">
							Seus <span className="accent">dados</span>
						</h1>
						<Suspense fallback={<div className="priv-card">Carregando...</div>}>
							<Confirm />
						</Suspense>
					</div>
				</main>
			</div>
		</div>
	);
}
