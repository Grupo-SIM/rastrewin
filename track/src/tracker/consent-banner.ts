/*
 * Banner de consentimento (LGPD) do t.js. Fica num Shadow DOM: o CSS do site não quebra o banner
 * e o do banner não vaza para o site. Não bloqueia a página (a pessoa navega sem escolher).
 *
 * Regras (orientação da ANPD sobre cookies):
 * - "Recusar" tem o MESMO destaque que "Aceitar todos", já na primeira tela;
 * - marketing vem DESLIGADO nas preferências até a pessoa ligar;
 * - os textos vêm do painel (Configurações › Privacidade) e são inseridos como texto, nunca como HTML.
 *
 * PERSONALIZAR o visual: o site pode trocar as cores e a fonte com variáveis CSS no elemento
 * #trck-consent, por exemplo:
 *   #trck-consent { --trck-bg: #0b120f; --trck-fg: #f2f5f3; --trck-accent: #22c55e; --trck-accent-fg: #04130a; }
 */

export interface BannerTexts {
	title: string;
	body: string;
	accept: string;
	reject: string;
	preferences: string;
	save: string;
	policyLink: string;
	necessaryTitle: string;
	necessaryDescription: string;
	marketingTitle: string;
	marketingDescription: string;
}

export type BannerAction = "accept_all" | "reject_all" | "custom";

export interface BannerOptions {
	texts: BannerTexts;
	policyUrl: string | null;
	/** Estado atual do marketing (para as preferências). */
	marketing: boolean;
	/** Abrir direto nas preferências (link "Preferências de cookies" do site). */
	preferences: boolean;
	onChoice: (choice: { marketing: boolean; action: BannerAction }) => void;
}

const CSS = `
:host { all: initial; }
.box {
	--bg: var(--trck-bg, #ffffff); --fg: var(--trck-fg, #17201b); --muted: var(--trck-muted, #4b5650);
	--line: var(--trck-line, #d9dfdb); --accent: var(--trck-accent, #17201b); --accent-fg: var(--trck-accent-fg, #ffffff);
	position: fixed; z-index: 2147483000; left: 16px; right: 16px; bottom: 16px; max-width: 540px;
	box-sizing: border-box; max-height: calc(100vh - 32px); overflow: auto;
	background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: var(--trck-radius, 14px);
	box-shadow: 0 12px 40px rgba(0,0,0,.18); padding: 20px;
	font: 400 14px/1.55 var(--trck-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
}
@media (prefers-color-scheme: dark) {
	.box { --bg: var(--trck-bg, #121a16); --fg: var(--trck-fg, #eef3f0); --muted: var(--trck-muted, #b4c0b9);
		--line: var(--trck-line, #2a3630); --accent: var(--trck-accent, #eef3f0); --accent-fg: var(--trck-accent-fg, #121a16); }
}
h2 { margin: 0 0 6px; font-size: 16px; font-weight: 700; line-height: 1.3; }
p { margin: 0 0 12px; color: var(--muted); }
a { color: var(--fg); text-decoration: underline; }
.row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
button { box-sizing: border-box; min-height: 44px; padding: 0 18px; border-radius: 10px; cursor: pointer;
	font-family: inherit; font-size: 14px; font-weight: 600; line-height: 1.2; flex: 1 1 0; min-width: max-content; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
.solid { background: var(--accent); color: var(--accent-fg); border: 1px solid var(--accent); }
.ghost { background: transparent; color: var(--fg); border: 1px solid var(--line); }
.cat { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between;
	padding: 12px 0; border-top: 1px solid var(--line); }
.cat h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; }
.cat p { margin: 0; font-size: 13px; }
.switch { position: relative; flex: none; width: 44px; height: 26px; margin-top: 2px; }
.switch input { appearance: none; -webkit-appearance: none; margin: 0; width: 44px; height: 26px; border-radius: 26px;
	background: var(--line); cursor: pointer; transition: background .15s; }
.switch input:checked { background: var(--accent); }
.switch input:disabled { opacity: .6; cursor: not-allowed; }
.switch span { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
	background: var(--bg); pointer-events: none; transition: transform .15s; }
.switch input:checked + span { transform: translateX(18px); }
@media (max-width: 480px) {
	.box { left: 8px; right: 8px; bottom: 8px; padding: 16px; }
	/* Recusar e Aceitar lado a lado, com a mesma largura; o terceiro botão embaixo. */
	.solid { flex: 1 1 0; min-width: 0; }
	.ghost { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) { .switch input, .switch span { transition: none; } }
`;

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<Record<string, string>> = {},
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(props)) if (v !== undefined) node.setAttribute(k, v);
	if (text !== undefined) node.textContent = text;
	return node;
}

/** Só links http(s) (o texto do painel nunca vira javascript:). */
function safeUrl(url: string | null): string | null {
	if (!url) return null;
	try {
		const u = new URL(url, location.href);
		return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
	} catch {
		return null;
	}
}

/** Mostra o banner. Devolve a função que o fecha. */
export function showConsentBanner(o: BannerOptions): () => void {
	document.getElementById("trck-consent")?.remove();
	const host = el("div", { id: "trck-consent" });
	const root = host.attachShadow({ mode: "open" });
	root.appendChild(el("style", {}, CSS));
	const box = el("div", {
		"aria-labelledby": "trck-title",
		"aria-modal": "false",
		class: "box",
		role: "dialog",
	});
	root.appendChild(box);

	let closed = false;
	let guard: ReturnType<typeof setInterval> | undefined;
	const close = () => {
		closed = true;
		clearInterval(guard);
		host.remove();
	};
	const choose = (marketing: boolean, action: BannerAction) => {
		close();
		o.onChoice({ action, marketing });
	};
	const button = (label: string, cls: string, onClick: () => void) => {
		const b = el("button", { class: cls, type: "button" }, label);
		b.addEventListener("click", onClick);
		return b;
	};

	const intro = () => {
		box.replaceChildren(el("h2", { id: "trck-title" }, o.texts.title));
		const p = el("p", {}, o.texts.body);
		const href = safeUrl(o.policyUrl);
		if (href) {
			p.append(" ");
			p.append(el("a", { href, rel: "noopener", target: "_blank" }, o.texts.policyLink));
		}
		box.append(p);
		const row = el("div", { class: "row" });
		// Recusar e Aceitar com o MESMO estilo; Preferências como secundário.
		row.append(
			button(o.texts.reject, "solid", () => choose(false, "reject_all")),
			button(o.texts.accept, "solid", () => choose(true, "accept_all")),
			button(o.texts.preferences, "ghost", prefs),
		);
		box.append(row);
	};

	const category = (title: string, description: string, input: HTMLInputElement) => {
		const id = `trck-${Math.random().toString(36).slice(2, 8)}`;
		input.id = id;
		const text = el("div");
		const h3 = el("h3");
		h3.append(el("label", { for: id }, title));
		text.append(h3, el("p", {}, description));
		const sw = el("div", { class: "switch" });
		sw.append(input, el("span", { "aria-hidden": "true" }));
		const row = el("div", { class: "cat" });
		row.append(text, sw);
		return row;
	};

	function prefs() {
		box.replaceChildren(el("h2", { id: "trck-title" }, o.texts.title));
		const necessary = el("input", { checked: "", disabled: "", role: "switch", type: "checkbox" });
		const marketing = el("input", { role: "switch", type: "checkbox" });
		marketing.checked = o.marketing;
		box.append(
			category(o.texts.necessaryTitle, o.texts.necessaryDescription, necessary),
			category(o.texts.marketingTitle, o.texts.marketingDescription, marketing),
		);
		const href = safeUrl(o.policyUrl);
		if (href) {
			const p = el("p");
			p.append(el("a", { href, rel: "noopener", target: "_blank" }, o.texts.policyLink));
			box.append(p);
		}
		const row = el("div", { class: "row" });
		row.append(
			button(o.texts.reject, "solid", () => choose(false, "reject_all")),
			button(o.texts.accept, "solid", () => choose(true, "accept_all")),
			button(o.texts.save, "ghost", () => choose(marketing.checked, "custom")),
		);
		box.append(row);
		marketing.focus({ preventScroll: true });
	}

	if (o.preferences) prefs();
	else intro();

	// Sites em React/Next: um nó extra no <body> antes da hidratação causa erro e o React pode
	// recriar o documento (o banner some). Então o banner só entra depois do "load", e volta se
	// algo o remover enquanto a pessoa ainda não escolheu.
	// No início do <body>: fica cedo na ordem do Tab (teclado) sem roubar o foco da página.
	const mount = () => {
		if (closed) return;
		document.body.prepend(host);
		guard = setInterval(() => {
			if (!closed && !host.isConnected) document.body.prepend(host);
		}, 500);
	};
	if (o.preferences || document.readyState === "complete") mount();
	else window.addEventListener("load", () => setTimeout(mount, 0), { once: true });
	return close;
}
