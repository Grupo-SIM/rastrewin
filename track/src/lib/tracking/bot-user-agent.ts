/*
 * Robôs reconhecidos pelo navegador (user agent). Puro e testado: as rotas de captura usam junto com
 * o filtro por rede (src/lib/geo/bot-networks.ts) e com o aviso de automação do t.js (`wd`).
 */

export type BotReason = "robo" | "nuvem" | "declarado" | "chrome-antigo" | "automacao" | "sem-navegador";

/** Texto de cada motivo (aba Saúde). */
export const BOT_REASON_LABEL: Record<BotReason, string> = {
	automacao: "Navegador controlado por programa",
	"chrome-antigo": "Chrome muito antigo (versão abaixo de 100)",
	declarado: "Se identifica como robô",
	nuvem: "Servidor de nuvem ou hospedagem",
	robo: "Robô da Meta ou do Google",
	"sem-navegador": "Sem identificação de navegador",
};

/** Menor versão do Chrome aceita (a 100 é de 2022; o Chrome se atualiza sozinho). */
export const MIN_CHROME = 100;

// Robôs que se declaram. "bot" só como palavra ou antes de "/" (Googlebot/2.1, AhrefsBot/7.0),
// para não pegar marcas de celular como "CUBOT_X30".
const DECLARED =
	/\bbot\b|bot\/|crawler|spider|slurp|headlesschrome|lighthouse|chrome-lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|python-requests|python-urllib|aiohttp|\bcurl\/|\bwget\/|go-http-client|okhttp\/|axios\/|node-fetch|undici|phantomjs|puppeteer|playwright|selenium|facebookexternalhit|meta-externalagent|google web preview/i;

// Chrome "puro" (desktop ou Android), sem outro navegador por cima. Navegadores de fabricante
// (Samsung, Xiaomi, Oppo/Realme, UC…) e o navegador interno de apps (Instagram, Facebook, "; wv")
// usam motores antigos de propósito e NÃO entram nesta regra.
const PLAIN_CHROME =
	/^Mozilla\/5\.0 \(([^)]*)\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/(\d+)\.[\d.]+ (?:Mobile )?Safari\/537\.36$/;

/** Motivo de o navegador ser de robô, ou null para um navegador comum. */
export function botUserAgentReason(userAgent: string | null | undefined): BotReason | null {
	const ua = userAgent?.trim() ?? "";
	if (!ua) return "sem-navegador";
	if (DECLARED.test(ua)) return "declarado";
	const chrome = PLAIN_CHROME.exec(ua);
	if (chrome && !/;\s*wv\b/.test(chrome[1]) && Number(chrome[2]) < MIN_CHROME) return "chrome-antigo";
	return null;
}
