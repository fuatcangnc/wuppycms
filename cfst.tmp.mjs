import { chromium } from "@playwright/test";

const ctx = await chromium.launchPersistentContext("/tmp/opencode/chrome-prof", {
  executablePath: "/usr/bin/chromium",
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: ["--no-sandbox"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://app.wuppycms.com/login", { waitUntil: "networkidle", timeout: 90000 });
if (page.url().includes("/login")) {
  const inputs = page.locator("input");
  await inputs.nth(0).fill("admin@wuppycms.com");
  await inputs.nth(1).fill("Wuppy-Admin-2026-9x7K!");
  await page.locator("button[type=submit]").click();
  await page.waitForTimeout(6000);
}
const res = await page.request.post("https://app.wuppycms.com/api/deploy/sync", {
  data: { full_name: "fuatcangnc/pc-tamir", target: "cloudflare" },
  timeout: 120000,
});
console.log("CF SYNC:", res.status(), await res.text());
await ctx.close();
