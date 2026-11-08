import type { AccountKind } from "./validation";

/** Dados que vão para o navegador — NUNCA incluem segredos, só a pista mascarada. */
export interface AccountView {
	id: string;
	kind: AccountKind;
	label: string;
	externalId: string;
	secretHint: string;
	active: boolean;
	lastTestAt: string | null;
	lastTestStatus: "ok" | "warning" | "error" | null;
	lastTestMessage: string | null;
}

export interface GeneralView {
	currency: string;
	testEventCode: string;
	allowedOrigins: string[];
	checkoutDomains: string[];
	webhookTokenHint: string | null;
	webhookUrl: string;
	scriptUrl: string;
	ga4Debug: boolean;
	/** Fuso horário do painel (IANA) */
	timezone: string;
	/** Último evento recebido no webhook de vendas (para conferir a integração). */
	lastWebhook: {
		eventType: string;
		orderId: string | null;
		receivedAt: string;
		processed: boolean;
		error: string | null;
	} | null;
}

/** Limpeza diária (agendada pelo app) + diagnóstico do proxy. Estados calculados no servidor. */
export interface MaintenanceView {
	/** nunca = ainda não rodou; rodando = em andamento; atrasada = última execução ok há mais de 36 h. */
	health: "ok" | "erro" | "rodando" | "atrasada" | "nunca";
	lastRun: {
		startedAt: string;
		finishedAt: string | null;
		rowsPayloads: number;
		rowsSessions: number;
		rowsCache: number;
		error: string | null;
	} | null;
	nextRunAt: string;
	retentionDays: number;
	/** IP desta requisição como o servidor o enxerga, e de qual cabeçalho veio. */
	ip: string | null;
	ipSource: "x-real-ip" | "x-forwarded-for" | null;
	/** APP_URL em https (produção atrás do proxy). */
	production: boolean;
}

export interface ConfigView {
	general: GeneralView;
	maintenance: MaintenanceView;
	accounts: Record<AccountKind, AccountView[]>;
}

export type ActionResult<T = undefined> =
	| { ok: true; message?: string; data?: T }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };
