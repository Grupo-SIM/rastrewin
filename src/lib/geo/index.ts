import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Reader, type CityResponse } from "maxmind";
import { brStateToUf } from "./br-states";

/*
 * Geolocalização OFFLINE a partir do IP (base DB-IP City Lite, CC BY 4.0).
 * Arquivo: data/geo/dbip-city-lite.mmdb — baixado por `npm run geo:download` e no build do Docker.
 * Sem o arquivo, o tracking continua funcionando, só sem geo.
 */

export type Geo = {
  /** ISO 3166-1 alpha-2 (ex.: "BR") */
  country: string | null;
  /** UF no Brasil (ex.: "SP"); fora do Brasil, o nome da subdivisão */
  region: string | null;
  city: string | null;
};

const DB_PATH = path.join(process.cwd(), "data", "geo", "dbip-city-lite.mmdb");
const g = globalThis as unknown as { __geoReader?: Reader<CityResponse> | null };

function reader(): Reader<CityResponse> | null {
  if (g.__geoReader !== undefined) return g.__geoReader;
  try {
    g.__geoReader = new Reader<CityResponse>(fs.readFileSync(DB_PATH));
  } catch {
    console.warn(`[geo] base não encontrada em ${DB_PATH} — rode "npm run geo:download". Seguindo sem geo.`);
    g.__geoReader = null;
  }
  return g.__geoReader;
}

const EMPTY: Geo = { country: null, region: null, city: null };

export function lookupGeo(ip: string | null): Geo {
  if (!ip) return EMPTY;
  try {
    const hit = reader()?.get(ip);
    if (!hit) return EMPTY;
    const country = hit.country?.iso_code ?? null;
    const subdivision = hit.subdivisions?.[0]?.names?.en ?? null;
    const region = country === "BR" ? (brStateToUf(subdivision) ?? subdivision) : subdivision;
    return { country, region, city: hit.city?.names?.en ?? null };
  } catch {
    return EMPTY;
  }
}
