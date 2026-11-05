/*
 * Redes (ASN) de robôs que executam o JavaScript da página e, por isso, disparam o t.js:
 * a revisão de anúncios e a prévia de links da Meta (data centers como Prineville, Oregon) e os
 * robôs do Google. Visitas dessas redes não são de clientes: o track as ignora (sem visitante,
 * sem evento e sem envio à Meta/GA4). O user agent deles é de um Chrome comum, por isso o filtro é
 * pelo dono do IP (base DB-IP ASN Lite, ver scripts/geo-download.sh).
 */
export const BOT_ASNS: Readonly<Record<number, string>> = {
	15169: "Google",
	32934: "Meta",
};

/** Nome da rede de robôs dona do ASN, ou null se for uma rede comum. */
export function botNetworkName(asn: number | null | undefined): string | null {
	return asn ? (BOT_ASNS[asn] ?? null) : null;
}
