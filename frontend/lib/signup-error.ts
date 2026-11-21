/*
 * Mensagens de erro do cadastro para o cliente: nunca mostram o erro técnico (status, JSON, nome da API).
 * O detalhe vai só para o console do navegador, para o suporte investigar.
 */

const CONTACT_EMAIL = "contatosimintermediacoes@gmail.com";

/** Campos do formulário: o nome que o backend usa → o rótulo que o cliente vê. */
const FIELD_LABELS: Record<string, string> = {
	city: "Cidade",
	cpf: "CPF",
	email: "E-mail",
	name: "Nome completo",
	phone: "Telefone",
	pix: "Chave Pix",
};

export const CHECKOUT_NOT_OPENED =
	"Seu cadastro foi salvo, mas não conseguimos abrir o pagamento agora. Tente de novo em alguns minutos.";

const OFFLINE = "Não conseguimos conectar. Confira sua internet e tente de novo.";
const GENERIC = `Não conseguimos concluir seu cadastro agora. Tente de novo em alguns minutos. Se continuar, escreva para ${CONTACT_EMAIL}.`;

const joinLabels = (labels: string[]) =>
	labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;

/**
 * Campos do formulário que o backend recusou. O `api()` lança `Error("<status> <corpo>")`, e a validação
 * do backend (class-validator) responde 400 com `message: ["email must be an email", ...]`, em que a
 * 1ª palavra é o campo. Só conta se TODAS as mensagens forem de campos do formulário.
 */
function rejectedFields(message: string): string[] {
	const match = message.match(/^400 ([\s\S]*)$/);
	if (!match) return [];
	try {
		const body = JSON.parse(match[1] ?? "") as { message?: unknown };
		if (!Array.isArray(body.message) || !body.message.length) return [];
		const labels: string[] = [];
		for (const item of body.message) {
			const label = typeof item === "string" ? FIELD_LABELS[item.split(" ")[0] ?? ""] : undefined;
			if (!label) return [];
			if (!labels.includes(label)) labels.push(label);
		}
		return labels;
	} catch {
		return [];
	}
}

/** Texto para o cliente a partir do erro do envio do cadastro. */
export function signupErrorMessage(error: unknown): string {
	// fetch sem resposta (sem internet, servidor fora do ar, bloqueio de rede): TypeError
	if (error instanceof TypeError) return OFFLINE;
	const labels = rejectedFields(error instanceof Error ? error.message : "");
	if (labels.length === 1) return `Confira o campo ${labels[0]} e tente de novo.`;
	if (labels.length > 1) return `Confira os campos ${joinLabels(labels)} e tente de novo.`;
	return GENERIC;
}
