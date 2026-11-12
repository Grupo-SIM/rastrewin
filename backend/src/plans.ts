import { PrismaService } from "./prisma/prisma.service";

/** Planos: preço e limite de inscrições em sorteios por dia (calendário). */
export const PLANS = {
	basico: { limit: 500, name: "Básico", price: 150 },
	pro: { limit: 2000, name: "Pro", price: 500 },
	vip: { limit: 5000, name: "VIP", price: 1000 },
} as const;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const planLimit = (plan: string) => PLANS[plan as PlanId]?.limit ?? 0;

/** Link de checkout do plano, configurável por ambiente (ex.: SIMPAY_CHECKOUT_URL_PRO). */
export const checkoutUrlFor = (plan: string) => process.env[`SIMPAY_CHECKOUT_URL_${plan.toUpperCase()}`];

/** Dados do cadastro que o checkout do SimIntPay usa para pré-preencher o formulário de pagamento. */
export interface CheckoutPrefill {
	cpf: string;
	email: string;
	name: string;
	phone: string;
}

/** Link de checkout do plano com nome, e-mail, CPF e telefone já informados (?name=&email=&document=&phone=). */
export function checkoutUrlWithPrefill(plan: string, prefill: CheckoutPrefill) {
	const base = checkoutUrlFor(plan);
	if (!base) return undefined;
	const url = new URL(base);
	url.searchParams.set("name", prefill.name.trim());
	url.searchParams.set("email", prefill.email.trim());
	url.searchParams.set("document", prefill.cpf.replace(/\D/g, ""));
	url.searchParams.set("phone", prefill.phone.replace(/\D/g, ""));
	return url.toString();
}

/**
 * Vencimento "preguiçoso": o simpay só avisa cancelamento explícito (subscription_expired),
 * não quando a renovação simplesmente não acontece. Então, toda leitura de um usuário ACTIVE
 * confere se o período pago já passou e marca EXPIRED na hora, sem depender de cron job.
 */
export async function expireIfPastDue(
	prisma: PrismaService,
	user: { id: string; status: string; expiresAt: Date | null },
) {
	if (user.status !== "ACTIVE" || !user.expiresAt || user.expiresAt.getTime() > Date.now())
		return user.status;
	await prisma.user.update({ data: { status: "EXPIRED" }, where: { id: user.id } });
	return "EXPIRED";
}
