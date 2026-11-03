import type { AccountKind } from "./validation";

/** Dados que vão para o navegador — NUNCA incluem segredos, só a pista mascarada. */
export type AccountView = {
  id: string;
  kind: AccountKind;
  label: string;
  externalId: string;
  secretHint: string;
  active: boolean;
  lastTestAt: string | null;
  lastTestStatus: "ok" | "warning" | "error" | null;
  lastTestMessage: string | null;
};

export type GeneralView = {
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
  lastWebhook: { eventType: string; orderId: string | null; receivedAt: string; processed: boolean; error: string | null } | null;
};

export type ConfigView = {
  general: GeneralView;
  accounts: Record<AccountKind, AccountView[]>;
};

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
