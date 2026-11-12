/*
 * Rastrewin — script de captura do site (compilado para /public/t.js por `npm run tracker:build`).
 *
 * Instalação (no <head> de todas as páginas):
 *   <script>window.trck=window.trck||function(){(trck.q=trck.q||[]).push(arguments)};</script>
 *   <script async src="https://SEU-TRACK/t.js"></script>
 *
 * Opções (atributos no <script src=".../t.js">):
 *   data-no-pixel  → o site já carrega o Pixel da Meta (não carregamos de novo; só usamos o fbq existente)
 *   data-no-ga     → o site já carrega a gtag do GA4
 *   data-no-auto   → não dispara InitiateCheckout/Contact automaticamente nos cliques
 *   data-no-banner → o site mostra o PRÓPRIO banner de consentimento e informa a escolha com
 *                    trck('consent', { marketing: true | false })
 *
 * Consentimento (LGPD): NADA de marketing roda antes do aceite. Sem a escolha guardada (cookie
 * _trck_consent) para a versão atual do texto, o t.js mostra o banner e não grava _trck/_fbp/_fbc,
 * não guarda UTMs, não carrega Pixel nem gtag e não chama o servidor (só /api/consent, com a escolha).
 * Comandos trck(...) feitos antes do aceite são descartados.
 *   trck('consent', 'open')  → reabre as preferências (link "Preferências de cookies" no rodapé)
 *
 * Uso:
 *   trck('track', 'Lead', { value: 10, currency: 'BRL' })
 *   trck('track', 'ViewContent', { content_ids: ['ebook-1'], content_name: 'Ebook', value: 47 })
 *   trck('identify', { email: 'a@b.com', phone: '11999999999', first_name: 'Ana', last_name: 'Silva' })
 *   trck('video', { id: 'vimeo:123', title: 'VSL', duration: 600, position: 95, watched: 90, cta: 150 })
 *     → só para a aba Vídeos do painel (nunca vai à Meta nem ao GA4).
 *
 * "Purchase" NÃO é aceito aqui: a compra vem do webhook da plataforma de venda (servidor).
 */

import { type BannerAction, type BannerTexts, showConsentBanner } from "./consent-banner";

type Dict = Record<string, unknown>;
interface PublicConfig {
	pixels: string[];
	ga4: string[];
	checkoutDomains: string[];
	currency: string;
	consent: { version: string; policyUrl: string | null; texts: BannerTexts };
}
interface UserData {
	email?: string;
	phone?: string;
	first_name?: string;
	last_name?: string;
}
type Fbq = ((...args: unknown[]) => void) & {
	callMethod?: (...args: unknown[]) => void;
	queue?: unknown[];
	push?: unknown;
	loaded?: boolean;
	version?: string;
};
type TrckWindow = Window & {
	__trckLoaded?: boolean;
	trck?: ((...args: unknown[]) => void) & { q?: unknown[][]; id?: string };
	fbq?: Fbq;
	_fbq?: Fbq;
	gtag?: (...args: unknown[]) => void;
	dataLayer?: unknown[];
};

(() => {
	const w = window as TrckWindow;
	if (w.__trckLoaded) return;
	w.__trckLoaded = true;

	const script =
		(document.currentScript as HTMLScriptElement | null) ??
		document.querySelector<HTMLScriptElement>('script[src*="/t.js"]');
	if (!script) return;
	const BASE = new URL(script.src).origin;
	const opt = (name: string) => script.hasAttribute(`data-${name}`);

	const ID_KEY = "_trck";
	const UTM_KEY = "_trck_utm";
	const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
	const DAY = 864e5;
	const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
	const GOOGLE_GRANTED = {
		ad_personalization: "granted",
		ad_storage: "granted",
		ad_user_data: "granted",
		analytics_storage: "granted",
	};
	const GOOGLE_DENIED = {
		ad_personalization: "denied",
		ad_storage: "denied",
		ad_user_data: "denied",
		analytics_storage: "denied",
	};

	// ---------------------------------------------------------------- utilitários
	const rand = (n: number, alphabet: string) => {
		const bytes = new Uint8Array(n);
		crypto.getRandomValues(bytes);
		let s = "";
		bytes.forEach(b => (s += alphabet[b % alphabet.length]));
		return s;
	};
	const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : rand(32, "0123456789abcdef"));

	const getCookie = (name: string): string | null => {
		const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&");
		const m = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
		if (!m) return null;
		try {
			return decodeURIComponent(m[1]);
		} catch {
			return m[1];
		}
	};

	// Domínio raiz para o cookie valer em todos os subdomínios (ex.: .meusite.com.br)
	let cookieDomain: string | null = null;
	const rootDomain = () => {
		if (cookieDomain !== null) return cookieDomain;
		const parts = location.hostname.split(".");
		for (let i = parts.length - 2; i >= 0; i--) {
			const d = parts.slice(i).join(".");
			document.cookie = `_trck_t=1; domain=${d}; path=/; SameSite=Lax`;
			if (getCookie("_trck_t")) {
				document.cookie = `_trck_t=; domain=${d}; path=/; max-age=0`;
				return (cookieDomain = d);
			}
		}
		return (cookieDomain = "");
	};
	const setCookie = (name: string, value: string, days: number) => {
		const d = rootDomain();
		document.cookie =
			`${name}=${encodeURIComponent(value)}; path=/; max-age=${Math.round(days * 86400)}; SameSite=Lax` +
			(d ? `; domain=${d}` : "") +
			(location.protocol === "https:" ? "; Secure" : "");
	};
	const store = {
		get: (k: string) => {
			try {
				return localStorage.getItem(k);
			} catch {
				return null;
			}
		},
		set: (k: string, v: string) => {
			try {
				localStorage.setItem(k, v);
			} catch {
				/* modo privado */
			}
		},
	};
	const params = new URLSearchParams(location.search);

	// ---------------------------------------------------------------- identidade (SÓ depois do aceite)
	// Nada aqui roda antes do aceite de marketing no banner (LGPD): sem cookie _trck, sem UTMs
	// guardadas e sem _fbc/_fbp. startIdentity() é chamada por start().
	let trckId = "";
	let utms: Record<string, string> = {};
	let fbc: string | null = null;

	function startIdentity() {
		let id = params.get("trck");
		if (!id || !ID_RE.test(id)) id = getCookie(ID_KEY) ?? store.get(ID_KEY);
		if (!id || !ID_RE.test(id)) id = rand(16, "abcdefghijklmnopqrstuvwxyz0123456789");
		trckId = id;
		setCookie(ID_KEY, trckId, 400);
		store.set(ID_KEY, trckId);

		// UTMs: última origem com UTM (guardada por 90 dias)
		const fromUrl: Record<string, string> = {};
		UTM_FIELDS.forEach(k => {
			const v = params.get(k);
			if (v) fromUrl[k] = v.slice(0, 300);
		});
		if (Object.keys(fromUrl).length) {
			utms = fromUrl;
			store.set(UTM_KEY, JSON.stringify({ ...fromUrl, _t: Date.now() }));
		} else {
			try {
				const saved = JSON.parse(store.get(UTM_KEY) || "null") as
					(Record<string, string> & { _t?: number }) | null;
				if (saved?._t && Date.now() - saved._t < 90 * DAY) {
					delete saved._t;
					utms = saved;
				}
			} catch {
				/* ignora */
			}
		}

		// Meta: _fbc (clique no anúncio) e _fbp (navegador) — formato fb.1.<timestamp>.<valor>
		const fbclid = params.get("fbclid");
		fbc = getCookie("_fbc");
		if (fbclid && !fbc?.endsWith(`.${fbclid}`)) {
			fbc = `fb.1.${Date.now()}.${fbclid}`;
			setCookie("_fbc", fbc, 90);
		}
		if (!getCookie("_fbp")) setCookie("_fbp", `fb.1.${Date.now()}.${rand(10, "0123456789")}`, 90);
	}
	const fbIds = () => ({ fbc: getCookie("_fbc") ?? fbc, fbp: getCookie("_fbp") });

	// ---------------------------------------------------------------- GA4 (ids)
	let cfg: PublicConfig | null = null;
	let ga: { ga_client_id: string | null; ga_session_id: string | null } = {
		ga_client_id: null,
		ga_session_id: null,
	};

	const gaClientFromCookie = () => getCookie("_ga")?.match(/^GA\d\.\d\.(\d+\.\d+)$/)?.[1] ?? null;
	const gaSessionFromCookie = (mid: string) => {
		const v = getCookie(`_ga_${mid.replace(/^G-/, "")}`);
		if (!v) return null;
		const gs2 = v.match(/^GS2\.\d\.(.+)$/); // GS2.1.s1730000000$o2$g1$t...
		if (gs2)
			return (
				gs2[1]
					.split("$")
					.find(p => /^s\d+$/.test(p))
					?.slice(1) ?? null
			);
		return v.match(/^GS1\.\d\.(\d+)\./)?.[1] ?? null; // GS1.1.1730000000.1....
	};
	const gtagGet = (mid: string, field: string) =>
		new Promise<string | null>(resolve => {
			if (!w.gtag) return resolve(null);
			const timer = setTimeout(() => resolve(null), 1500);
			w.gtag("get", mid, field, (value: unknown) => {
				clearTimeout(timer);
				resolve(value === undefined || value === null ? null : String(value));
			});
		});
	const readGaIds = async () => {
		const mid = cfg?.ga4[0];
		if (!mid) return { ga_client_id: gaClientFromCookie(), ga_session_id: null };
		const [client, session] = await Promise.all([gtagGet(mid, "client_id"), gtagGet(mid, "session_id")]);
		return {
			ga_client_id: client && /^\d+\.\d+$/.test(client) ? client : gaClientFromCookie(),
			ga_session_id: session && /^\d+$/.test(session) ? session : gaSessionFromCookie(mid),
		};
	};
	// Na 1ª visita a gtag pode não ter carregado a tempo (e o cookie _ga ainda não existe).
	// Sem client_id, a compra iria ao GA4 como usuário novo e sem origem: tenta de novo em
	// segundo plano e, quando conseguir, atualiza o visitante (os eventos seguintes já levam).
	async function refreshGaIds() {
		for (const wait of [2000, 5000, 15_000]) {
			if (ga.ga_client_id && ga.ga_session_id) return;
			await new Promise(resolve => setTimeout(resolve, wait));
			const next = await readGaIds();
			const changed =
				(next.ga_client_id && next.ga_client_id !== ga.ga_client_id) ||
				(next.ga_session_id && next.ga_session_id !== ga.ga_session_id);
			if (!changed) continue;
			ga = {
				ga_client_id: next.ga_client_id ?? ga.ga_client_id,
				ga_session_id: next.ga_session_id ?? ga.ga_session_id,
			};
			identify();
		}
	}

	// ---------------------------------------------------------------- carregamento de Pixel e gtag
	function loadPixel(ids: string[]) {
		if (!w.fbq) {
			const n: Fbq = (...args: unknown[]) => {
				if (n.callMethod) n.callMethod(...args);
				else n.queue!.push(args);
			};
			w.fbq = n;
			if (!w._fbq) w._fbq = n;
			n.push = n;
			n.loaded = true;
			n.version = "2.0";
			n.queue = [];
			const s = document.createElement("script");
			s.async = true;
			s.src = "https://connect.facebook.net/en_US/fbevents.js";
			document.head.appendChild(s);
		}
		ids.forEach(pid => w.fbq!("init", pid, { external_id: trckId }));
	}

	function loadGtag(mids: string[]) {
		w.dataLayer = w.dataLayer || [];
		if (!w.gtag) {
			w.gtag = function () {
				// eslint-disable-next-line prefer-rest-params
				w.dataLayer!.push(arguments);
			};
			// Consent Mode do Google: a gtag só é carregada depois do aceite no banner.
			w.gtag("consent", "default", GOOGLE_GRANTED);
			w.gtag("js", new Date());
		} else {
			w.gtag("consent", "update", GOOGLE_GRANTED);
		}
		const s = document.createElement("script");
		s.async = true;
		s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(mids[0])}`;
		document.head.appendChild(s);
		mids.forEach(mid => w.gtag!("config", mid)); // page_view automático da gtag
	}

	// ---------------------------------------------------------------- envio ao servidor
	// Navegador controlado por programa (Selenium, Puppeteer, Playwright): o servidor ignora a visita.
	const automated = (() => {
		try {
			return navigator.webdriver === true;
		} catch {
			return false;
		}
	})();

	function send(path: string, body: Dict) {
		// Todo envio de captura leva a versão do consentimento aceito (o servidor ignora sem ela).
		const withConsent = path === "/api/consent" ? body : { ...body, consent: cfg?.consent.version };
		const payload = JSON.stringify(automated ? { ...withConsent, wd: true } : withConsent);
		const beacon = () => navigator.sendBeacon?.(BASE + path, payload);
		try {
			// text/plain evita o preflight do CORS; o servidor valida a origem e o JSON.
			fetch(BASE + path, {
				body: payload,
				credentials: "omit",
				headers: { "content-type": "text/plain" },
				keepalive: payload.length < 60_000,
				method: "POST",
				mode: "cors",
			}).catch(beacon);
		} catch {
			beacon();
		}
	}

	// Dados do lead informados nesta página: vão junto nos eventos seguintes
	// (evita a corrida identify × evento chegando ao servidor ao mesmo tempo).
	let knownUser: Dict = {};

	function identify(user: UserData = {}) {
		const data = pick(user as Dict, ["email", "phone", "first_name", "last_name"]);
		if (Object.keys(data).length) knownUser = { ...knownUser, ...data };
		send("/api/identify", {
			trck_user_id: trckId,
			...fbIds(),
			...ga,
			...utms,
			landing_url: location.href,
			pixel_id: cfg?.pixels[0] ?? null,
			referrer: document.referrer || null,
			...data,
		});
	}

	// ---------------------------------------------------------------- eventos
	const STANDARD = new Set([
		"AddPaymentInfo",
		"AddToCart",
		"AddToWishlist",
		"CompleteRegistration",
		"Contact",
		"CustomizeProduct",
		"Donate",
		"FindLocation",
		"InitiateCheckout",
		"Lead",
		"PageView",
		"Schedule",
		"Search",
		"StartTrial",
		"SubmitApplication",
		"Subscribe",
		"ViewContent",
	]);
	const GA4_NAMES: Record<string, string> = {
		AddPaymentInfo: "add_payment_info",
		AddToCart: "add_to_cart",
		AddToWishlist: "add_to_wishlist",
		CompleteRegistration: "sign_up",
		Contact: "contact",
		InitiateCheckout: "begin_checkout",
		Lead: "generate_lead",
		Schedule: "schedule",
		Search: "search",
		StartTrial: "start_trial",
		Subscribe: "subscribe",
		ViewContent: "view_item",
	};
	const gaName = (name: string) =>
		GA4_NAMES[name] ??
		name
			.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
			.toLowerCase()
			.slice(0, 40);

	function pick(obj: Dict, keys: string[]) {
		const out: Dict = {};
		keys.forEach(k => {
			if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") out[k] = obj[k];
		});
		return out;
	}

	function track(name: string, data: Dict = {}, user?: UserData) {
		if (!/^[A-Za-z][A-Za-z0-9_]{1,39}$/.test(name))
			return console.warn("[trck] nome de evento inválido:", name);
		if (name.toLowerCase() === "purchase") {
			return console.warn(
				"[trck] Purchase é enviado pelo servidor (webhook de vendas) — ignorado aqui.",
			);
		}
		const eventId = uuid();
		const custom = pick(data, [
			"value",
			"currency",
			"content_ids",
			"content_name",
			"content_type",
			"num_items",
		]);
		if (custom.value !== undefined) {
			custom.value = Number(custom.value);
			if (!Number.isFinite(custom.value)) delete custom.value;
			else if (!custom.currency) custom.currency = cfg?.currency;
		}

		// Navegador: Pixel (mesmo eventID → a Meta deduplica com o servidor) e gtag
		w.fbq?.(STANDARD.has(name) ? "track" : "trackCustom", name, custom, { eventID: eventId });
		if (name !== "PageView" && w.gtag && cfg?.ga4.length) {
			const ids = (custom.content_ids as string[] | undefined) ?? [];
			// O GA4 exige items em begin_checkout/view_item/add_to_cart: sem ids, vai o nome.
			const items = ids.length
				? ids.map(item_id => ({ item_id, item_name: custom.content_name }))
				: custom.content_name
					? [{ item_name: custom.content_name }]
					: [];
			w.gtag("event", gaName(name), {
				...(custom.value !== undefined ? { currency: custom.currency, value: custom.value } : {}),
				...(items.length ? { items } : {}),
			});
		}

		// Servidor: Conversions API
		send("/api/event", {
			event_id: eventId,
			event_name: name,
			event_source_url: location.href,
			trck_user_id: trckId,
			...fbIds(),
			...ga,
			// Mesmas UTMs do identify: o PageView sai junto com ele e pode chegar antes.
			...utms,
			...(Object.keys(custom).length ? { custom_data: custom } : {}),
			...(() => {
				const ud = {
					...knownUser,
					...pick((user ?? {}) as Dict, ["email", "phone", "first_name", "last_name"]),
				};
				return Object.keys(ud).length ? { user_data: ud } : {};
			})(),
		});
	}

	// ---------------------------------------------------------------- vídeo
	// Progresso de vídeo SÓ para o painel (aba Vídeos): vai direto para /api/video.
	// Nunca chama Pixel/gtag nem /api/event — não chega à Meta nem ao GA4.
	//   trck('video', { id: 'vimeo:123', title, duration, position, watched, ended, cta })
	const videoViews: Record<string, string> = {};
	const seconds = (v: unknown) => {
		const n = Number(v);
		return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 21_600) : 0;
	};
	function video(data: Dict = {}) {
		const id = String(data.id ?? "");
		if (!/^[a-z]{2,20}:[A-Za-z0-9_-]{1,64}$/.test(id))
			return console.warn("[trck] vídeo sem id válido (ex.: vimeo:123):", id);
		send("/api/video", {
			...(seconds(data.cta) ? { cta: seconds(data.cta) } : {}),
			duration: seconds(data.duration),
			ended: data.ended === true,
			page_url: location.href,
			position: seconds(data.position),
			title: typeof data.title === "string" ? data.title.slice(0, 300) : null,
			trck_user_id: trckId,
			video_id: id,
			// um play por vídeo a cada carregamento da página
			view_id: (videoViews[id] ??= uuid()),
			watched: seconds(data.watched),
		});
	}

	// ---------------------------------------------------------------- links de checkout e WhatsApp
	const isWhatsApp = (host: string) => /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/.test(host);
	const isCheckout = (host: string) =>
		!!cfg?.checkoutDomains.some(d => host === d || host.endsWith(`.${d}`));

	function decorate(a: HTMLAnchorElement): "checkout" | "whatsapp" | null {
		let url: URL;
		try {
			url = new URL(a.href, location.href);
		} catch {
			return null;
		}
		if (isCheckout(url.hostname)) {
			// O SimIntPay repassa src, utm_*, fbc e fbp para o webhook da venda.
			if (!url.searchParams.has("src")) url.searchParams.set("src", trckId);
			Object.entries(utms).forEach(([k, v]) => {
				if (!url.searchParams.has(k)) url.searchParams.set(k, v);
			});
			const { fbp, fbc } = fbIds();
			if (fbc && !url.searchParams.has("fbc")) url.searchParams.set("fbc", fbc);
			if (fbp && !url.searchParams.has("fbp")) url.searchParams.set("fbp", fbp);
			if (a.href !== url.toString()) a.href = url.toString();
			return "checkout";
		}
		if (isWhatsApp(url.hostname)) {
			const tag = `Ref: ${trckId}`;
			const text = url.searchParams.get("text") ?? "";
			if (!text.includes(tag)) {
				url.searchParams.set("text", text ? `${text}\n\n${tag}` : tag);
				// wa.me espera espaço como %20 (URLSearchParams usa "+"); "+" literal já sai como %2B
				url.search = url.searchParams.toString().replace(/\+/g, "%20");
				a.href = url.toString();
			}
			return "whatsapp";
		}
		return null;
	}

	const lastAuto: Record<string, number> = {};
	function onLinkInteraction(event: Event) {
		const a = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
		if (!a || !cfg || !started) return;
		const kind = decorate(a);
		if (!kind || event.type !== "click" || opt("no-auto")) return;
		const name = kind === "checkout" ? "InitiateCheckout" : "Contact";
		if (Date.now() - (lastAuto[name] ?? 0) < 2000) return; // evita duplo clique
		lastAuto[name] = Date.now();
		track(name);
	}
	["click", "auxclick", "contextmenu", "touchstart"].forEach(type =>
		document.addEventListener(type, onLinkInteraction, { capture: true, passive: true }),
	);

	// ---------------------------------------------------------------- consentimento (LGPD)
	// Escolha guardada no cookie _trck_consent (domínio raiz): { id aleatório, v = versão do texto, m = marketing }.
	// PERSONALIZAR: por quanto tempo a escolha vale antes de perguntar de novo.
	const CONSENT_KEY = "_trck_consent";
	const CONSENT_DAYS = 365;
	interface ConsentState {
		id: string;
		v: string;
		m: boolean;
	}
	const readConsent = (): ConsentState | null => {
		try {
			const c = JSON.parse(getCookie(CONSENT_KEY) || "null") as Partial<ConsentState> | null;
			return c &&
				typeof c.id === "string" &&
				ID_RE.test(c.id) &&
				typeof c.v === "string" &&
				typeof c.m === "boolean"
				? (c as ConsentState)
				: null;
		} catch {
			return null;
		}
	};
	let consent = readConsent();
	let started = false;
	let closeBanner: (() => void) | null = null;
	const consentVersion = () => cfg?.consent.version ?? "";
	const marketingOn = () => !!consent && consent.v === consentVersion() && consent.m;

	/** Página sem query nem # (a query pode levar fbclid, UTMs ou dados pessoais). */
	const pageUrl = () => location.origin + location.pathname;

	function deleteCookie(name: string) {
		const d = rootDomain();
		document.cookie = `${name}=; path=/; max-age=0`;
		if (d) document.cookie = `${name}=; path=/; max-age=0; domain=${d}`;
	}

	/** Revogação: apaga os identificadores de marketing deste navegador (nossos, da Meta e do Google). */
	function clearMarketingStorage() {
		document.cookie.split("; ").forEach(c => {
			const name = c.split("=")[0];
			if ([ID_KEY, "_fbp", "_fbc", "_ga", "_gid", "_gcl_au"].includes(name) || name.startsWith("_ga_"))
				deleteCookie(name);
		});
		try {
			localStorage.removeItem(ID_KEY);
			localStorage.removeItem(UTM_KEY);
		} catch {
			/* modo privado */
		}
	}

	function choose(marketing: boolean, action: BannerAction) {
		if (!cfg) return;
		const previousId = trckId || getCookie(ID_KEY) || store.get(ID_KEY);
		const id = consent?.id ?? rand(16, "abcdefghijklmnopqrstuvwxyz0123456789");
		consent = { id, m: marketing, v: consentVersion() };
		setCookie(CONSENT_KEY, JSON.stringify(consent), CONSENT_DAYS);
		const record = { consent_id: id, page_url: pageUrl(), version: consentVersion() };

		if (marketing) {
			void start().then(() =>
				send("/api/consent", { ...record, action, marketing: true, trck_user_id: trckId }),
			);
			return;
		}
		// Recusa. Se este navegador já tinha um visitante (aceite anterior ou de antes do banner), é revogação.
		const revoking = !!previousId && ID_RE.test(previousId);
		send("/api/consent", {
			...record,
			action: revoking ? "revoke" : action,
			marketing: false,
			...(revoking ? { trck_user_id: previousId } : {}),
		});
		if (!revoking) return;
		w.gtag?.("consent", "update", GOOGLE_DENIED);
		w.fbq?.("consent", "revoke");
		clearMarketingStorage();
		// Pixel e gtag já carregados nesta página só param recarregando.
		if (started) setTimeout(() => location.reload(), 400);
	}

	function openBanner(preferences: boolean) {
		if (!cfg || !document.body) return;
		closeBanner?.();
		closeBanner = showConsentBanner({
			marketing: marketingOn(),
			onChoice: ({ action, marketing }) => {
				closeBanner = null;
				choose(marketing, action);
			},
			policyUrl: cfg.consent.policyUrl,
			preferences,
			texts: cfg.consent.texts,
		});
	}

	// ---------------------------------------------------------------- início do rastreamento (depois do aceite)
	async function start() {
		if (started || !cfg) return;
		started = true;
		startIdentity();
		if (!opt("no-pixel") && cfg.pixels.length) loadPixel(cfg.pixels);
		else w.fbq?.("consent", "grant");
		if (!opt("no-ga") && cfg.ga4.length) loadGtag(cfg.ga4);
		else w.gtag?.("consent", "update", GOOGLE_GRANTED);
		document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(decorate);
		ga = await readGaIds();
		identify();
		track("PageView");
		if (cfg.ga4.length) void refreshGaIds();
	}

	// ---------------------------------------------------------------- inicialização
	const ready: Promise<boolean> = (async () => {
		try {
			const response = await fetch(`${BASE}/api/config/public`, { credentials: "omit" });
			cfg = response.ok ? ((await response.json()) as PublicConfig) : null;
		} catch {
			cfg = null;
		}
		if (!cfg) {
			console.warn(
				"[trck] este site não está autorizado no Rastrewin (Configurações › Sites autorizados).",
			);
			return false;
		}
		if (marketingOn()) await start();
		// Sem escolha para a versão atual do texto: pergunta (de novo, se o texto mudou).
		else if (!(consent && consent.v === consentVersion()) && !opt("no-banner")) {
			if (document.body) openBanner(false);
			else document.addEventListener("DOMContentLoaded", () => openBanner(false), { once: true });
		}
		return true;
	})();

	// ---------------------------------------------------------------- API pública: trck(...)
	function run(command: unknown, args: unknown[]) {
		if (command === "consent") {
			const arg = args[0] as { marketing?: unknown } | string | undefined;
			if (arg === "open") openBanner(true);
			else if (arg && typeof arg === "object" && typeof arg.marketing === "boolean")
				choose(arg.marketing, arg.marketing ? "accept_all" : "reject_all");
			else console.warn("[trck] use trck('consent', 'open') ou trck('consent', { marketing: true })");
			return;
		}
		// LGPD: sem o aceite de marketing, comandos de rastreamento são descartados (nada fica guardado).
		if (!started) return;
		if (command === "track")
			track(String(args[0]), (args[1] as Dict) ?? {}, args[2] as UserData | undefined);
		else if (command === "identify") identify((args[0] as UserData) ?? {});
		else if (command === "video") video((args[0] as Dict) ?? {});
		else console.warn("[trck] comando desconhecido:", command);
	}
	const pending = w.trck?.q ?? [];
	const api = (...args: unknown[]) => {
		void ready.then(ok => ok && run(args[0], args.slice(1)));
	};
	// id do visitante (só existe depois do aceite).
	Object.defineProperty(api, "id", { enumerable: true, get: () => trckId || undefined });
	w.trck = api;
	pending.forEach(args => api(...args));
})();
