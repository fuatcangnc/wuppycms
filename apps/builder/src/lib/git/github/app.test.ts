// GitHub App kurulum state'i — imza, kurcalama ve süre sınırı.

import { describe, expect, it, vi, afterEach } from "vitest";
import type { AppEnv } from "../../../api/types";
import { createInstallState, verifyInstallState } from "./app";

const env = { BETTER_AUTH_SECRET: "test-secret" } as AppEnv;

afterEach(() => {
	vi.useRealTimers();
});

describe("GitHub App install state", () => {
	it("imzalı state'i aynı kullanıcıyla doğrular", async () => {
		const state = await createInstallState(env, "user-1");
		expect(state).toBeTruthy();
		await expect(verifyInstallState(env, state ?? undefined)).resolves.toBe("user-1");
	});

	it("başka anahtarla üretilmiş state'i reddeder", async () => {
		const state = await createInstallState(env, "user-1");
		const other = { BETTER_AUTH_SECRET: "another-secret" } as AppEnv;
		await expect(verifyInstallState(other, state ?? undefined)).resolves.toBeNull();
	});

	it("kurcalanmış gövdeyi reddeder", async () => {
		const state = (await createInstallState(env, "user-1")) ?? "";
		const [payload, signature] = state.split(".");
		const forgedPayload = Buffer.from(JSON.stringify({ uid: "user-2", ts: Date.now() }))
			.toString("base64url");
		await expect(
			verifyInstallState(env, `${forgedPayload}.${signature}`),
		).resolves.toBeNull();
		expect(payload).toBeTruthy();
	});

	it("30 dakikadan eski state'i reddeder", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
		const state = await createInstallState(env, "user-1");
		vi.setSystemTime(new Date("2026-10-29T12:31:00Z"));
		await expect(verifyInstallState(env, state ?? undefined)).resolves.toBeNull();
	});

	it("state yoksa null döner", async () => {
		await expect(verifyInstallState(env, undefined)).resolves.toBeNull();
	});
});
