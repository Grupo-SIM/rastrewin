/** Estados do Brasil: nome (como vem da base de IP, com ou sem acento/inglês) → UF. */
const STATES: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "federal district": "DF",
  "espirito santo": "ES",
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
