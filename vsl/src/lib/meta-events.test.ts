import { afterEach, describe, expect, it, vi } from "vitest";
import { vslEvent } from "./meta-events";

describe("vslEvent", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("manda pelo t.js com page_type vsl e só para a Meta (ga4: false)", () => {
		const trck = vi.fn();
		vi.stubGlobal("window", { trck });
		vslEvent("VSLCTAUnlock", { reason: "watched", video_id: "vimeo:1" });
		expect(trck).toHaveBeenCalledWith("track", "VSLCTAUnlock", {
			ga4: false,
			page_type: "vsl",
			reason: "watched",
			video_id: "vimeo:1",
		});
	});

	it("não deixa os parâmetros trocarem o ga4", () => {
		const trck = vi.fn();
		vi.stubGlobal("window", { trck });
		vslEvent("CTAClick", { button: "quero_conhecer", ga4: "x" } as Record<string, string>);
		expect(trck.mock.calls[0]?.[2]).toMatchObject({ ga4: false, page_type: "vsl" });
	});

	it("nunca lança erro: sem t.js ou com t.js quebrado", () => {
		vi.stubGlobal("window", {});
		expect(() => vslEvent("VSLStart")).not.toThrow();
		vi.stubGlobal("window", {
			trck: () => {
				throw new Error("quebrado");
			},
		});
		expect(() => vslEvent("VSLStart")).not.toThrow();
	});
});
