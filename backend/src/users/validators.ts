import { buildMessage, ValidateBy, type ValidationOptions } from "class-validator";

/** CPF com dígito verificador (aceita com ou sem máscara). */
export function isValidCpf(value: string) {
	const d = value.replace(/\D/g, "");
	if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
	const digit = (len: number) => {
		let sum = 0;
		for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
		const r = (sum * 10) % 11;
		return r === 10 ? 0 : r;
	};
	return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

export function IsCpf(options?: ValidationOptions) {
	return ValidateBy(
		{
			name: "isCpf",
			validator: {
				defaultMessage: buildMessage(e => `${e} deve ser um CPF válido`, options),
				validate: v => typeof v === "string" && isValidCpf(v),
			},
		},
		options,
	);
}

/** Telefone brasileiro: de 10 a 13 dígitos (DDD + número, com ou sem o 55 e o 9). */
export function IsBrPhone(options?: ValidationOptions) {
	return ValidateBy(
		{
			name: "isBrPhone",
			validator: {
				defaultMessage: buildMessage(e => `${e} deve ser um telefone válido`, options),
				validate: v => {
					if (typeof v !== "string" || !/^[\d\s()+-]+$/.test(v)) return false;
					const n = v.replace(/\D/g, "").length;
					return n >= 10 && n <= 13;
				},
			},
		},
		options,
	);
}
