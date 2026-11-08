/*
 * Redes (ASN) que não são de clientes. O user agent dos robôs é de um Chrome comum, por isso o filtro
 * é pelo dono do IP (base DB-IP ASN Lite, ver scripts/geo-download.sh). Visitas dessas redes são
 * ignoradas: sem visitante, sem evento e sem envio à Meta/GA4.
 *
 * - "robo": a revisão de anúncios e a prévia de links da Meta (data centers como Prineville, Oregon)
 *   e os robôs do Google, que executam o JavaScript da página e disparavam o t.js.
 * - "nuvem": servidores de nuvem e hospedagem. Gente comum não navega a partir deles; robôs, sim.
 *   Quem usa VPN às vezes sai por eles (risco aceito: o público é brasileiro e de celular).
 *
 * Fica de FORA de propósito: Cloudflare (13335), Akamai CDN (36183) e Fastly (54113). Eles levam o
 * tráfego real da "Retransmissão Privada" do iCloud (Safari no iPhone) e do WARP.
 */
export type BotNetworkKind = "robo" | "nuvem";

export const BOT_ASNS: Readonly<Record<number, { name: string; kind: BotNetworkKind }>> = {
	8075: { kind: "nuvem", name: "Microsoft Azure" },
	14061: { kind: "nuvem", name: "DigitalOcean" },
	14618: { kind: "nuvem", name: "Amazon AWS" },
	15169: { kind: "robo", name: "Google" },
	16276: { kind: "nuvem", name: "OVH" },
	16509: { kind: "nuvem", name: "Amazon AWS" },
	20473: { kind: "nuvem", name: "Vultr" },
	24940: { kind: "nuvem", name: "Hetzner" },
	28753: { kind: "nuvem", name: "Leaseweb" },
	31898: { kind: "nuvem", name: "Oracle Cloud" },
	32934: { kind: "robo", name: "Meta" },
	37963: { kind: "nuvem", name: "Alibaba Cloud" },
	45090: { kind: "nuvem", name: "Tencent Cloud" },
	45102: { kind: "nuvem", name: "Alibaba Cloud" },
	51167: { kind: "nuvem", name: "Contabo" },
	60781: { kind: "nuvem", name: "Leaseweb" },
	63949: { kind: "nuvem", name: "Linode (Akamai Cloud)" },
	132203: { kind: "nuvem", name: "Tencent Cloud" },
	136907: { kind: "nuvem", name: "Huawei Cloud" },
	139070: { kind: "nuvem", name: "Google Cloud" },
	396982: { kind: "nuvem", name: "Google Cloud" },
};

/** Rede de robôs/nuvem dona do ASN, ou null se for uma rede comum. */
export function botNetworkOf(asn: number | null | undefined): { name: string; kind: BotNetworkKind } | null {
	return asn ? (BOT_ASNS[asn] ?? null) : null;
}

/** Nome da rede de robôs/nuvem dona do ASN, ou null se for uma rede comum. */
export function botNetworkName(asn: number | null | undefined): string | null {
	return botNetworkOf(asn)?.name ?? null;
}
