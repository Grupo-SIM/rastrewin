export function maskCpf(value: string) {
	return value
		.replace(/\D/g, "")
		.slice(0, 11)
		.replace(/(\d{3})(\d)/, "$1.$2")
		.replace(/(\d{3})(\d)/, "$1.$2")
		.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Telefone BR no formato (DD) 9XXXX-XXXX. O preenchimento automático do celular costuma trazer o DDI
 * (+55 18 99641-2577): sem tirar o 55, o corte em 11 dígitos perdia os 2 últimos do número.
 * DDD nunca começa com 0, então um 0 na frente (018...) também sai.
 */
export function maskPhone(value: string) {
	let d = value.replace(/\D/g, "").replace(/^0+/, "");
	if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
	d = d.slice(0, 11);
	if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
	return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

/** Valida CPF pelos dígitos verificadores (algoritmo padrão da Receita Federal). */
export function isValidCpf(raw: string) {
	const cpf = raw.replace(/\D/g, "");
	if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
	const digits = cpf.split("").map(Number);
	const check = (len: number) => {
		let sum = 0;
		for (let i = 0; i < len; i++) sum += digits[i] * (len + 1 - i);
		const r = (sum * 10) % 11;
		return r === 10 ? 0 : r;
	};
	return check(9) === digits[9] && check(10) === digits[10];
}
