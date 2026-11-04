/** Estados do Brasil: nome (como vem da base de IP, com ou sem acento/inglês) → UF. */
const STATES: Record<string, string> = {
	acre: "AC",
	alagoas: "AL",
	amapa: "AP",
	amazonas: "AM",
	bahia: "BA",
	ceara: "CE",
	"distrito federal": "DF",
	"espirito santo": "ES",
	"federal district": "DF",
	goias: "GO",
	maranhao: "MA",
	"mato grosso": "MT",
	"mato grosso do sul": "MS",
	"minas gerais": "MG",
	para: "PA",
	paraiba: "PB",
	parana: "PR",
	pernambuco: "PE",
	piaui: "PI",
	"rio de janeiro": "RJ",
	"rio grande do norte": "RN",
	"rio grande do sul": "RS",
	rondonia: "RO",
	roraima: "RR",
	"santa catarina": "SC",
	"sao paulo": "SP",
	sergipe: "SE",
	tocantins: "TO",
};

export const BR_UFS = [...new Set(Object.values(STATES))].sort();

export function stripAccents(value: string) {
	return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** "São Paulo" | "Federal District" | "SP" → "SP"; desconhecido → null */
export function brStateToUf(name: string | null | undefined): string | null {
	if (!name) return null;
	const key = stripAccents(name).toLowerCase().trim();
	if (/^[a-z]{2}$/.test(key) && BR_UFS.includes(key.toUpperCase())) return key.toUpperCase();
	return STATES[key] ?? null;
}

/** Código IBGE da UF (malha oficial do IBGE) → sigla. */
export const IBGE_UF: Record<string, string> = {
	"11": "RO",
	"12": "AC",
	"13": "AM",
	"14": "RR",
	"15": "PA",
	"16": "AP",
	"17": "TO",
	"21": "MA",
	"22": "PI",
	"23": "CE",
	"24": "RN",
	"25": "PB",
	"26": "PE",
	"27": "AL",
	"28": "SE",
	"29": "BA",
	"31": "MG",
	"32": "ES",
	"33": "RJ",
	"35": "SP",
	"41": "PR",
	"42": "SC",
	"43": "RS",
	"50": "MS",
	"51": "MT",
	"52": "GO",
	"53": "DF",
};

export const UF_NAME: Record<string, string> = {
	AC: "Acre",
	AL: "Alagoas",
	AM: "Amazonas",
	AP: "Amapá",
	BA: "Bahia",
	CE: "Ceará",
	DF: "Distrito Federal",
	ES: "Espírito Santo",
	GO: "Goiás",
	MA: "Maranhão",
	MG: "Minas Gerais",
	MS: "Mato Grosso do Sul",
	MT: "Mato Grosso",
	PA: "Pará",
	PB: "Paraíba",
	PE: "Pernambuco",
	PI: "Piauí",
	PR: "Paraná",
	RJ: "Rio de Janeiro",
	RN: "Rio Grande do Norte",
	RO: "Rondônia",
	RR: "Roraima",
	RS: "Rio Grande do Sul",
	SC: "Santa Catarina",
	SE: "Sergipe",
	SP: "São Paulo",
	TO: "Tocantins",
};
