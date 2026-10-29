/**
 * İnceleme akışı — "Send to review" → review dalı + PR → diff → onay → merge.
 * Ana dal merge'e kadar değişmez.
 */

import { test, expect } from "../fixtures";

test.describe("Review", () => {
	test("gönder → diff → onayla → birleştir", async ({ admin, page, request, serverInfo }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");

		await page.getByRole("button", { name: "Send to review" }).click();
		await expect(page).toHaveURL(/\/reviews/, { timeout: 30_000 });
		await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
		await expect(page.getByText("Awaiting review")).toBeVisible({ timeout: 30_000 });

		await page.getByRole("button", { name: "Diff" }).first().click();
		await expect(page.getByText(/Review diff/)).toBeVisible({ timeout: 30_000 });
		const diffDialog = page.getByRole("dialog");
		await diffDialog.getByRole("button", { name: "Close" }).last().click();

		await page.getByRole("button", { name: "Approve" }).first().click();
		await expect(page.getByText("Approved").first()).toBeVisible({ timeout: 30_000 });

		await page.getByRole("button", { name: "Merge" }).first().click();
		await expect(page.getByText("No open reviews")).toBeVisible({ timeout: 30_000 });

		// Merge sonrası ana dal hâlâ okunabilir.
		const params = new URLSearchParams({
			full_name: serverInfo.repoFullName,
			path: "src/content/blog/merhaba-dunya.mdx",
			ref: "main",
		});
		const res = await request.get(`/api/git/file?${params}`);
		expect(res.ok()).toBe(true);
	});
});
