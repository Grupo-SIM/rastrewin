import { customType, inet, text, timestamp } from "drizzle-orm/pg-core";

/** bytea — usado para segredos cifrados com pgp_sym_encrypt. Colunas terminadas em `_enc`. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const utmColumns = () => ({
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
});

/** Geo derivado do IP (offline). region = estado/UF. */
export const geoColumns = () => ({
  geoCountry: text("geo_country"),
  geoRegion: text("geo_region"),
  geoCity: text("geo_city"),
});

export const clientColumns = () => ({
  ip: inet("ip"),
  userAgent: text("user_agent"),
});

/** Resultado do último "Testar conexão" de uma conta. */
export const connectionTestColumns = () => ({
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  /** "ok" | "error" */
  lastTestStatus: text("last_test_status"),
  lastTestMessage: text("last_test_message"),
});
