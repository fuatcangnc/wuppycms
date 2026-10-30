import { chromium } from "@playwright/test";

const ctx = await chromium.launchPersistentContext("/tmp/opencode/chrome-prof", {
  executablePath: "/usr/bin/chromium",
  headless: true,
  viewport: { width: 1500, height: 1000 },
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
await page.goto("https://app.wuppycms.com/admin", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(6000);

const buttons = await page.locator("button").evaluateAll((els) =>
  els.slice(0, 60).map((e) => ({
    title: e.getAttribute("title"),
    aria: e.getAttribute("aria-label"),
    text: (e.innerText || "").trim().slice(0, 40),
  })),
);
console.log("BUTTONS", JSON.stringify(buttons, null, 0).slice(0, 2500));
const storage = await page.evaluate(() => ({
  site: localStorage.getItem("wuppycms:site"),
  keys: Object.keys(localStorage).slice(0, 12),
}));
console.log("STORAGE", JSON.stringify(storage));
await page.screenshot({ path: "/tmp/opencode/admin-probe.png", fullPage: false });
await ctx.close();
