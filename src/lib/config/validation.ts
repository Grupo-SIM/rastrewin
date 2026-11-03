import { z } from "zod";
import { isValidTimeZone } from "@/lib/time";

/* Normaliza e valida as entradas da tela de Configurações. Usado SÓ no servidor. */

export const ACCOUNT_KINDS = ["ga4", "pixel", "ads"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

const label = z.string().trim().min(1, "Dê um nome para a conta").max(60, "Máximo de 60 caracteres");

/** Segredo: vazio na edição significa "manter o atual". */
const secret = z
  .string()
  .trim()
  .max(1000, "Valor longo demais")
  .refine((v) => v === "" || (v.length >= 8 && !/\s/.test(v)), "Valor inválido (sem espaços, 8+ caracteres)");

const externalId: Record<AccountKind, z.ZodType<string>> = {
  ga4: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^G-[A-Z0-9]{4,20}$/, "Use o formato G-XXXXXXXXXX"),
  pixel: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^[0-9]{5,25}$/, "O ID do pixel tem só números")),
  ads: z
    .string()
    .transform((v) => v.replace(/\s/g, "").replace(/^act_/i, ""))
    .pipe(z.string().regex(/^[0-9]{5,25}$/, "Use o número da conta (com ou sem act_)")),
};

export function accountSchema(kind: AccountKind) {
  return z.object({
    id: z.uuid().optional(),
    label,
    externalId: externalId[kind],
    secret,
    active: z.boolean(),
  });
}

export type AccountInput = z.infer<ReturnType<typeof accountSchema>>;

// ---------------------------------------------------------------- geral

function lines(value: string) {
  return value
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** "https://meusite.com/qualquer" → "https://meusite.com". http só para localhost. */
const origins = z.string().transform((value, ctx) => {
  const result = new Set<string>();
  for (const item of lines(value)) {
    try {
      const url = new URL(item.includes("://") ? item : `https://${item}`);
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error();
      result.add(url.origin);
    } catch {
      ctx.addIssue({ code: "custom", message: `Origem inválida: ${item}` });
      return z.NEVER;
    }
  }
  if (result.size > 20) {
    ctx.addIssue({ code: "custom", message: "Máximo de 20 origens" });
    return z.NEVER;
  }
  return [...result];
});

/** "https://pay.exemplo.com/abc" → "pay.exemplo.com" */
const domains = z.string().transform((value, ctx) => {
  const result = new Set<string>();
  for (const item of lines(value)) {
    try {
      const host = new URL(item.includes("://") ? item : `https://${item}`).hostname.toLowerCase();
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) throw new Error();
      result.add(host);
    } catch {
      ctx.addIssue({ code: "custom", message: `Domínio inválido: ${item}` });
      return z.NEVER;
    }
  }
  if (result.size > 20) {
    ctx.addIssue({ code: "custom", message: "Máximo de 20 domínios" });
    return z.NEVER;
  }
  return [...result];
});

export const generalSchema = z.object({
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Moeda inválida (ex.: BRL)"),
  testEventCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-Za-z0-9_-]{4,40}$/.test(v), "Código inválido (ex.: TEST12345)"),
  allowedOrigins: origins,
  checkoutDomains: domains,
  ga4Debug: z.boolean(),
  timezone: z.string().trim().refine(isValidTimeZone, "Fuso horário inválido"),
});

export const webhookSecretSchema = z
  .string()
  .trim()
  .min(24, "O segredo precisa ter 24+ caracteres")
  .max(256, "Segredo longo demais")
  .refine((v) => !/\s/.test(v), "O segredo não pode ter espaços");

/** Junta os erros do zod por campo, na primeira mensagem de cada um. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
