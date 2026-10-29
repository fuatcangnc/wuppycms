// Projects ekranı + GitHub App durumu — kurulum yokken "App'i kur" kartı,
// mock reponun listelenmesi ve durum API'sinin sözleşmesi.

import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const WEBHOOK_SECRET = "e2e-webhook-secret";

function sign(body: string): string {
	return `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
}

test.describe("projects / GitHub App", () => {
	test("kurulum yokken App kartını gösterir ve repoyu listeler", async ({ page }) => {
		await page.goto("/projects");
		await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

		// Sunucu durumu: app yapılandırılmış, kurulum yok.
		await expect(page.getByText("No GitHub App installation yet.")).toBeVisible();
		await expect(page.getByRole("link", { name: "Install GitHub App" }).first()).toBeVisible();

		await page.getByRole("button", { name: /New project/i }).click();
		await expect(page.getByText("mock/site", { exact: true })).toBeVisible();
	});

	test("status ucu app + installations sözleşmesini döner", async ({ page }) => {
		const res = await page.request.get("/api/github/app/status");
		expect(res.ok()).toBeTruthy();
		const data = (await res.json()) as {
			app: { configured: boolean; slug: string; installUrl: string; manageUrl: string };
			installations: unknown[];
		};
		expect(data.app.configured).toBe(true);
		expect(data.app.slug).toBe("wuppycms");
		expect(data.app.installUrl).toBe("/api/github/app/install");
		expect(data.installations).toEqual([]);
	});

	test("kurulum ucu oturumu GitHub'a yönlendirir", async ({ page }) => {
		const res = await page.request.get("/api/github/app/install", { maxRedirects: 0 });
		expect(res.status()).toBe(302);
		const location = res.headers()["location"] ?? "";
		expect(location).toContain("https://github.com/apps/wuppycms/installations/new");
		expect(location).toContain("state=");
	});
});

test.describe("github app webhook", () => {
	test("geçerli imzayı kabul eder, bozuk imzayı reddeder", async ({ page }) => {
		const body = JSON.stringify({
			action: "created",
			installation: {
				id: 999_001,
				account: { login: "e2e-probe", type: "User" },
				repository_selection: "selected",
			},
		});

		const bad = await page.request.post("/api/github/app/webhook", {
			headers: {
				"content-type": "application/json",
				"x-github-event": "installation",
				"x-hub-signature-256": "sha256=deadbeef",
			},
			data: body,
		});
		expect(bad.status()).toBe(401);

		const good = await page.request.post("/api/github/app/webhook", {
			headers: {
				"content-type": "application/json",
				"x-github-event": "installation",
				"x-hub-signature-256": sign(body),
			},
			data: body,
		});
		expect(good.ok()).toBeTruthy();
		await expect(good.json()).resolves.toMatchObject({ ok: true });
	});
});
