import { describe, expect, it } from "vitest";
import { pageConfig } from "./page-config";
import { type PageConfig, PageConfigSchema } from "./page-config.schema";

const valid: PageConfig = {
	copy: {
		cta: "Começar",
		metaDisclaimer: "Aviso",
		subtitle: "Subtítulo",
		title: "Título",
	},
	destinationUrl: "https://rastrewin.com",
	posterSrc: "/poster.webp",
	siteUrl: "https://vsl.rastrewin.com",
	unlockAtSeconds: 165,
	youtubeId: "abcDEF12_-3",
};

const withChanges = (changes: Record<string, unknown>) => ({ ...valid, ...changes });

describe("PageConfigSchema", () => {
	it("aceita uma configuração válida", () => {
		expect(PageConfigSchema.safeParse(valid).success).toBe(true);
	});

	it("a configuração atual do projeto é válida", () => {
		expect(PageConfigSchema.safeParse(pageConfig).success).toBe(true);
	});

	it("aceita caminho no destino, mas só em rastrewin.com", () => {
		const result = PageConfigSchema.safeParse(
			withChanges({ destinationUrl: "https://rastrewin.com/planos" }),
		);
		expect(result.success).toBe(true);
	});

	it("remove espaços das pontas dos textos", () => {
		const result = PageConfigSchema.parse({ ...valid, copy: { ...valid.copy, title: "  Oi  " } });
		expect(result.copy.title).toBe("Oi");
	});

	it.each([
		["ID do YouTube curto", { youtubeId: "abc" }],
		["ID do YouTube com caractere inválido", { youtubeId: "abc<script>1" }],
		["segundos negativos", { unlockAtSeconds: -5 }],
		["segundos fracionados", { unlockAtSeconds: 1.5 }],
		["segundos acima do limite", { unlockAtSeconds: 9999 }],
		["destino em http", { destinationUrl: "http://rastrewin.com" }],
		["destino em outro domínio", { destinationUrl: "https://evil.com" }],
		["destino em subdomínio parecido", { destinationUrl: "https://rastrewin.com.evil.com" }],
		["destino com credenciais", { destinationUrl: "https://user:pass@rastrewin.com" }],
		["destino com porta", { destinationUrl: "https://rastrewin.com:8443" }],
		["destino javascript:", { destinationUrl: "javascript:alert(1)" }],
		["capa externa", { posterSrc: "https://cdn.com/a.webp" }],
		["capa com path traversal", { posterSrc: "/../etc/passwd.png" }],
		["site em http", { siteUrl: "http://vsl.rastrewin.com" }],
		["chave desconhecida", { extra: true }],
	])("rejeita %s", (_label, changes) => {
		expect(PageConfigSchema.safeParse(withChanges(changes)).success).toBe(false);
	});

	it("rejeita texto vazio ou longo demais", () => {
		expect(PageConfigSchema.safeParse({ ...valid, copy: { ...valid.copy, cta: "   " } }).success).toBe(
			false,
		);
		expect(
			PageConfigSchema.safeParse({ ...valid, copy: { ...valid.copy, cta: "x".repeat(41) } }).success,
		).toBe(false);
	});

	it("rejeita chave desconhecida dentro de copy", () => {
		const result = PageConfigSchema.safeParse({ ...valid, copy: { ...valid.copy, html: "<b>" } });
		expect(result.success).toBe(false);
	});

	it("mostra mensagens em português", () => {
		const result = PageConfigSchema.safeParse(withChanges({ destinationUrl: "https://evil.com" }));
		expect(result.error?.issues[0]?.message).toBe("O destino precisa ser https://rastrewin.com.");
	});
});
