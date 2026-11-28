import { MAX_ATTEMPTS, nextAttemptAt } from "./retry-schedule";

/*
 * Situação do envio de uma venda a um destino (Meta ou GA4), para o detalhe da venda e o aviso do
 * painel. Regra pura: o servidor calcula e o navegador só escreve a frase (deliveryText).
 */

/** A Conversions API recusa venda com mais de 7 dias (mesmo valor de simintpay.META_MAX_AGE_MS). */
const META_DEADLINE_MS = 7 * 24 * 3600 * 1000;

export type Destination = "meta" | "ga4";

export type DeliveryState =
	| { kind: "enviado"; at: string }
	| { kind: "renovacao" }
	| { kind: "sem-consentimento" }
	| { kind: "teste" }
	| { kind: "inativa" }
	| { kind: "sem-conta" }
	| { kind: "tentando"; attempts: number; nextAt: string }
	| { kind: "desistiu"; attempts: number; reason: "prazo" | "tentativas" };

export interface DeliveryInput {
	destination: Destination;
	sentAt: Date | null;
	attempts: number;
	consent: boolean;
	isTest: boolean;
	isRenewal: boolean;
	/** Venda aprovada (ou com reembolso só pedido): as outras não vão à Meta nem ao GA4. */
	active: boolean;
	/** Há pixel (Meta) ou propriedade (GA4) ativa em Configurações. */
	hasAccount: boolean;
	saleAt: Date;
	now: Date;
}

export function deliveryState(i: DeliveryInput): DeliveryState {
	if (i.sentAt) return { at: i.sentAt.toISOString(), kind: "enviado" };
	if (i.isRenewal) return { kind: "renovacao" };
	if (!i.consent) return { kind: "sem-consentimento" };
	if (i.isTest) return { kind: "teste" };
	if (!i.active) return { kind: "inativa" };
	if (i.destination === "meta" && i.now.getTime() - i.saleAt.getTime() > META_DEADLINE_MS)
		return { attempts: i.attempts, kind: "desistiu", reason: "prazo" };
	if (i.attempts >= MAX_ATTEMPTS) return { attempts: i.attempts, kind: "desistiu", reason: "tentativas" };
	if (!i.hasAccount && i.attempts === 0) return { kind: "sem-conta" };
	const next = nextAttemptAt(i.saleAt, i.attempts) ?? i.now;
	return { attempts: i.attempts, kind: "tentando", nextAt: next.toISOString() };
}

/** "Reenviar agora" faz sentido: ainda não foi, dá para mandar e o prazo da Meta não passou. */
export function canResend(state: DeliveryState, hasAccount: boolean): boolean {
	if (!hasAccount) return false;
	return state.kind === "tentando" || (state.kind === "desistiu" && state.reason === "tentativas");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "às 13:12" no mesmo dia, "em 29/11 às 01:12" em outro dia, "em instantes" se já passou da hora. */
export function whenText(iso: string, now: Date, timeZone: string): string {
	const at = new Date(iso);
	if (at.getTime() <= now.getTime()) return "em instantes";
	const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone });
	const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
	return day.format(at) === day.format(now)
		? `às ${time.format(at)}`
		: `em ${day.format(at)} às ${time.format(at)}`;
}

/** Frase da situação (sem o "Enviado em", que a tela já formata com data e hora). */
export function deliveryText(
	state: DeliveryState,
	destination: Destination,
	now: Date,
	timeZone: string,
): string {
	switch (state.kind) {
		case "enviado":
			return "Enviado";
		case "renovacao":
			return "Não enviado: renovação (só a 1ª compra vai à Meta e ao GA4)";
		case "sem-consentimento":
			return "Não enviado: o comprador não aceitou marketing no banner (LGPD)";
		case "teste":
			return "Não enviado: venda de visitante de teste";
		case "inativa":
			return "Não enviado: a venda não está aprovada";
		case "sem-conta":
			return destination === "meta"
				? "Não enviado: nenhum pixel ativo em Configurações"
				: "Não enviado: nenhuma propriedade GA4 ativa em Configurações";
		case "tentando": {
			const when = whenText(state.nextAt, now, timeZone);
			return state.attempts === 0
				? `Não enviado · 1ª tentativa ${when}, automática`
				: `Não enviado · ${plural(state.attempts, "tentativa", "tentativas")} · próxima ${when}, automática`;
		}
		case "desistiu":
			return state.reason === "prazo"
				? `Não enviado · desistiu depois de ${plural(state.attempts, "tentativa", "tentativas")}. A Meta não aceita venda com mais de 7 dias.`
				: `Não enviado · desistiu depois de ${plural(state.attempts, "tentativa", "tentativas")}.`;
	}
}
