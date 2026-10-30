import { chromium } from "@playwright/test";

const LOGO = "https://wuppycms.com/logo.png";
const ctx = await chromium.launchPersistentContext("/tmp/opencode/chrome-prof", {
  executablePath: "/usr/bin/chromium",
  headless: false,
  viewport: { width: 1500, height: 1100 },
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const log = (...a) => console.log(...a);
const shot = (n) => page.screenshot({ path: `/tmp/opencode/${n}.png`, fullPage: true });

async function closePortals() {
  for (let i = 0; i < 8; i += 1) {
    if (!(await page.locator("[data-base-ui-portal]").count())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
  }
}

await page.goto(
  "https://dash.cloudflare.com/3021eca8a72fcc73397d06623e76a077/oauth-clients",
  { waitUntil: "domcontentloaded", timeout: 90000 },
);
await page.waitForTimeout(9000);
const row = page.locator("tr").filter({ hasText: "WuppyCMS" }).first();
await row.getByRole("button", { name: "Client actions" }).click();
await page.waitForTimeout(1500);
await page.getByRole("menuitem", { name: "Edit" }).click();
await page.waitForTimeout(6000);

// 1) Grant type: Refresh Token ekle
const grant = page.getByRole("combobox").nth(1);
await grant.click({ force: true });
await page.waitForTimeout(1200);
const opts = page.getByRole("option");
const texts = await opts.allInnerTexts();
log("options", JSON.stringify(texts));
const refreshIdx = texts.findIndex((t) => /refresh/i.test(t));
const state = await opts.nth(refreshIdx).getAttribute("aria-selected");
log("refresh selected?", state);
if (state !== "true") {
  await opts.nth(refreshIdx).click({ force: true });
  await page.waitForTimeout(800);
}
await closePortals();
log("grant value now:", await grant.innerText());
await shot("cf-grant");

// 2) Advanced options + logo
await page.getByText("Advanced options", { exact: true }).click();
await page.waitForTimeout(2000);
const logo = page.locator('input[aria-label="Upload from URL"]');
await logo.fill(LOGO);
await page.waitForTimeout(500);
log("logo set");
await shot("cf-logo-set");

// 3) Devam
await page.getByRole("button", { name: /^Continue$/ }).click({ force: true });
await page.waitForTimeout(6000);
log("STEP2", (await page.locator("body").innerText()).slice(-600).replace(/\n+/g, " | "));

const cont2 = page.getByRole("button", { name: /^Continue$/ }).last();
if (await cont2.count()) {
  await cont2.click({ force: true });
  await page.waitForTimeout(5000);
}
log("STEP3", (await page.locator("body").innerText()).slice(-500).replace(/\n+/g, " | "));
await shot("cf-edit-step3");

const done = page.getByRole("button", { name: /Save|Finish|Update|Create client/i }).last();
if (await done.count()) {
  await done.click({ force: true });
  await page.waitForTimeout(7000);
}
log("FINAL", (await page.locator("body").innerText()).slice(-700).replace(/\n+/g, " | "));
await shot("cf-edit-final");
await page.waitForTimeout(20000);
await ctx.close();
