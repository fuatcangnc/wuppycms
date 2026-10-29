// Geliştirme token'ı kapısı — üretimde sunucu PAT'i müşteriye sızmamalı.

import { describe, expect, it } from "vitest";
import type { AppEnv } from "./types";
import { isDevGitTokenAllowed } from "./helpers";

const base = { GITHUB_TOKEN: "pat" } as AppEnv;

describe("isDevGitTokenAllowed", () => {
	it("yerel base URL'de izin verir", () => {
		expect(isDevGitTokenAllowed({ ...base, BETTER_AUTH_URL: "http://localhost:4321" })).toBe(true);
		expect(isDevGitTokenAllowed({ ...base, BETTER_AUTH_URL: "http://127.0.0.1:4444" })).toBe(true);
	});

	it("üretim base URL'inde reddeder", () => {
		expect(isDevGitTokenAllowed({ ...base, BETTER_AUTH_URL: "https://app.wuppycms.com" })).toBe(false);
	});

	it("token yoksa false", () => {
		expect(isDevGitTokenAllowed({ BETTER_AUTH_URL: "http://localhost:4321" } as AppEnv)).toBe(false);
	});
});
