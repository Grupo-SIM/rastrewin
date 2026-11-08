import "server-only";
import fs from "node:fs";
import path from "node:path";
import { type AsnResponse, type CityResponse, Reader } from "maxmind";
import { type BotNetworkKind, botNetworkOf } from "./bot-networks";
import { brStateToUf } from "./br-states";

/*
 * Geolocalização OFFLINE a partir do IP (bases DB-IP City Lite e ASN Lite, CC BY 4.0).
 * Arquivos: data/geo/dbip-city-lite.mmdb e data/geo/dbip-asn-lite.mmdb — baixados por
 * `npm run geo:download` e no build do Docker.
 * Sem os arquivos, o tracking continua funcionando, só sem geo e sem o filtro de robôs.
 */

export interface Geo {
	/** ISO 3166-1 alpha-2 (ex.: "BR") */
	country: string | null;
	/** UF no Brasil (ex.: "SP"); fora do Brasil, o nome da subdivisão */
	region: string | null;
	city: string | null;
}

const DB_PATH = path.join(process.cwd(), "data", "geo", "dbip-city-lite.mmdb");
const ASN_DB_PATH = path.join(process.cwd(), "data", "geo", "dbip-asn-lite.mmdb");
const g = globalThis as unknown as {
	__geoReader?: Reader<CityResponse> | null;
	__asnReader?: Reader<AsnResponse> | null;
};

function reader(): Reader<CityResponse> | null {
	if (g.__geoReader !== undefined) return g.__geoReader;
	try {
		g.__geoReader = new Reader<CityResponse>(fs.readFileSync(DB_PATH));
	} catch {
		console.warn(
			`[geo] base não encontrada em ${DB_PATH} — rode "npm run geo:download". Seguindo sem geo.`,
		);
		g.__geoReader = null;
	}
	return g.__geoReader;
}

const EMPTY: Geo = { city: null, country: null, region: null };

export function lookupGeo(ip: string | null): Geo {
	if (!ip) return EMPTY;
	try {
		const hit = reader()?.get(ip);
		if (!hit) return EMPTY;
		const country = hit.country?.iso_code ?? null;
		const subdivision = hit.subdivisions?.[0]?.names?.en ?? null;
		const region = country === "BR" ? (brStateToUf(subdivision) ?? subdivision) : subdivision;
		return { city: hit.city?.names?.en ?? null, country, region };
	} catch {
		return EMPTY;
	}
}

function asnReader(): Reader<AsnResponse> | null {
	if (g.__asnReader !== undefined) return g.__asnReader;
	try {
		g.__asnReader = new Reader<AsnResponse>(fs.readFileSync(ASN_DB_PATH));
	} catch {
		console.warn(
			`[geo] base de ASN não encontrada em ${ASN_DB_PATH} — rode "npm run geo:download". Seguindo sem filtro de robôs.`,
		);
		g.__asnReader = null;
	}
	return g.__asnReader;
}

/** Rede de robôs/nuvem dona do IP (ex.: Meta, Amazon AWS), ou null para visitantes comuns. */
export function botNetwork(ip: string | null): { name: string; kind: BotNetworkKind } | null {
	if (!ip) return null;
	try {
		return botNetworkOf(asnReader()?.get(ip)?.autonomous_system_number);
	} catch {
		return null;
	}
}
