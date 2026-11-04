import { describe, expect, it } from "vitest";
import { isAppleTouchDevice } from "./vimeo-player";

const IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID_CHROME =
	"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";

describe("isAppleTouchDevice", () => {
	it("reconhece o iPhone, em qualquer navegador", () => {
		expect(isAppleTouchDevice({ maxTouchPoints: 5, userAgent: IPHONE })).toBe(true);
		expect(isAppleTouchDevice({ maxTouchPoints: 5, userAgent: IPHONE_CHROME })).toBe(true);
	});

	it("reconhece o iPad que se apresenta como Mac, pelo toque", () => {
		expect(isAppleTouchDevice({ maxTouchPoints: 5, userAgent: MAC_SAFARI })).toBe(true);
	});

	it("não confunde Mac sem toque nem Android", () => {
		expect(isAppleTouchDevice({ maxTouchPoints: 0, userAgent: MAC_SAFARI })).toBe(false);
		expect(isAppleTouchDevice({ maxTouchPoints: 5, userAgent: ANDROID_CHROME })).toBe(false);
	});
});
