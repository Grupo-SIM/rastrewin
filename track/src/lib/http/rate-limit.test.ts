import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "./rate-limit";

test("token bucket: permite o burst e depois bloqueia", () => {
	const limiter = createRateLimiter({ burst: 3, perMinute: 60 });
	assert.equal(limiter.take("ip"), true);
	assert.equal(limiter.take("ip"), true);
	assert.equal(limiter.take("ip"), true);
	assert.equal(limiter.take("ip"), false);
	assert.equal(limiter.take("outro-ip"), true); // chaves independentes
});
