import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { botUserAgentReason } from "./bot-user-agent";

describe("botUserAgentReason", () => {
	it("navegadores comuns passam", () => {
		for (const ua of [
			// iPhone Safari, Chrome no iPhone, Android Chrome, desktop (Chrome, Edge, Firefox)
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
			"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
		])
			assert.equal(botUserAgentReason(ua), null, ua);
	});

	it("navegadores de fabricante e de apps com motor antigo passam", () => {
		for (const ua of [
			// Xiaomi, Samsung, Realme/Oppo e UC usam motor antigo de propósito
			"Mozilla/5.0 (Linux; Android 11; Redmi Note 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.116 Mobile Safari/537.36 XiaoMi/MiuiBrowser/13.5.40",
			"Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-J600G) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/13.0 Chrome/83.0.4103.106 Mobile Safari/537.36",
			"Mozilla/5.0 (Linux; U; Android 10; RMX2020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.80 Mobile Safari/537.36 HeyTapBrowser/45.7.4.1",
			"Mozilla/5.0 (Linux; U; Android 8.1.0; en-US; Nexus 6P) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/78.0.3904.108 UCBrowser/13.4.0.1306 Mobile Safari/537.36",
			// navegador do Instagram e WebView puro em aparelho antigo
			"Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36 Instagram 300.0.0.29.110 Android",
			"Mozilla/5.0 (Linux; Android 7.0; SM-G570M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.91 Mobile Safari/537.36",
			// marca de celular com "bot" no nome
			"Mozilla/5.0 (Linux; Android 12; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
		])
			assert.equal(botUserAgentReason(ua), null, ua);
	});

	it("Chrome puro muito antigo é robô (os casos vistos em produção)", () => {
		for (const ua of [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
			"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36",
		])
			assert.equal(botUserAgentReason(ua), "chrome-antigo", ua);
		const v100 =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36";
		assert.equal(botUserAgentReason(v100), null);
	});

	it("robôs declarados", () => {
		for (const ua of [
			"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
			"Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
			"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
			"python-requests/2.32.3",
			"curl/8.7.1",
		])
			assert.equal(botUserAgentReason(ua), "declarado", ua);
	});

	it("sem user agent", () => {
		assert.equal(botUserAgentReason(""), "sem-navegador");
		assert.equal(botUserAgentReason(null), "sem-navegador");
		assert.equal(botUserAgentReason("   "), "sem-navegador");
	});
});
