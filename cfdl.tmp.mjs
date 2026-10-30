import { chromium } from "@playwright/test";

const ctx = await chromium.launchPersistentContext("/tmp/opencode/chrome-prof", {
  executablePath: "/usr/bin/chromium",
  headless: false,
  viewport: { width: 1500, height: 1100 },
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(
  "https://dash.cloudflare.com/3021eca8a72fcc73397d06623e76a077/pages/view/wuppy-fuatcangnc-pc-tamir-r5htw",
  { waitUntil: "domcontentloaded", timeout: 90000 },
);
await page.waitForTimeout(10000);

const text = await page.locator("main").innerText().catch(async () => page.locator("body").innerText());
console.log("MAIN_HEAD", text.slice(0, 1200).replace(/\n+/g, " | "));
await page.screenshot({ path: "/tmp/opencode/cf-proj-top.png", fullPage: false });

// En yeni deployment satırına tıkla
const firstRow = page.getByText(/Production.*main|main.*Production/).first();
console.log("row count", await page.getByText("Details").count());
const details = page.getByRole("button", { name: /Details/i }).first();
if (await details.count()) {
  await details.click();
  await page.waitForTimeout(7000);
  console.log("DETAIL_URL", page.url());
  console.log(
    "DETAIL_BODY",
    (await page.locator("body").innerText()).slice(-2200).replace(/\n+/g, " | "),
  );
  await page.screenshot({ path: "/tmp/opencode/cf-deploy-detail.png", fullPage: true });
}
await page.waitForTimeout(20000);
await ctx.close();
