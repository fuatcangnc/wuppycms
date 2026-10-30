import { chromium } from "@playwright/test";

const ctx = await chromium.launchPersistentContext("/tmp/opencode/chrome-auto", {
  executablePath: "/usr/bin/chromium",
  headless: true,
  viewport: { width: 1200, height: 900 },
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE_ERR", m.text().slice(0, 120));
});

await page.goto("https://app.wuppycms.com/sandbox", { waitUntil: "domcontentloaded", timeout: 90000 });
const result = await page.evaluate(async () => {
  const log = [];
  try {
    const { WebContainer } = await import("https://esm.sh/@webcontainer/api@1.6.4");
    const wc = await WebContainer.boot();
    log.push("booted");
    await wc.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "astro-spike",
            private: true,
            type: "module",
            scripts: { dev: "astro dev" },
            dependencies: { astro: "^7.2.4" },
          }),
        },
      },
      "src/pages/index.astro": {
        file: {
          contents: `---\nconst msg = "Astro in WebContainer"\n---\n<html><body><h1>{msg}</h1></body></html>`,
        },
      },
      "astro.config.mjs": { file: { contents: `import { defineConfig } from "astro/config";\nexport default defineConfig({});` } },
    });
    log.push("mounted");

    const install = await wc.spawn("npm", ["install", "--no-audit", "--no-fund"]);
    install.output.pipeTo(new WritableStream({ write(c) { log.push("I:" + c.slice(0, 120)); } }));
    const ic = await install.exit;
    log.push("install exit " + ic);
    if (ic !== 0) return { ok: false, log };

    let url = null;
    wc.on("server-ready", (port, u) => { url = u; log.push("ready " + u); });
    const dev = await wc.spawn("npx", ["astro", "dev", "--host", "0.0.0.0", "--port", "4321"]);
    dev.output.pipeTo(new WritableStream({ write(c) { log.push("D:" + c.slice(0, 120)); } }));
    for (let i = 0; i < 60 && !url; i += 1) await new Promise((r) => setTimeout(r, 1000));
    return { ok: Boolean(url), url, log: log.slice(-40) };
  } catch (error) {
    return { ok: false, log: [...log, "ERR " + (error?.message ?? error)] };
  }
});
console.log("OK", result.ok, "URL", result.url ?? "-");
console.log(result.log.join("\n").slice(-2000));
await ctx.close();
