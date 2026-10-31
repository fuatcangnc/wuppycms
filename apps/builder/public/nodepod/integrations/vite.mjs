import { a as P, i as R, n as j, o as _, s as w, t as C } from "../headers-Dw0SzYIb.js";
import { dirname as b, resolve as A } from "node:path";
import { fileURLToPath as k } from "node:url";
import { readFile as v } from "node:fs/promises";
var F = ["../__worker__.js", "../../dist/__worker__.js"], u = null;
async function B(n) {
  const a = b(k(n));
  for (const d of F) {
    const s = A(a, d);
    try {
      return await v(s), s;
    } catch {
    }
  }
  return null;
}
async function g(n) {
  return u || (u = (async () => {
    const a = await B(n);
    return a ? v(a, "utf8") : null;
  })()), u;
}
var m = "/__worker__.js";
function $(n = {}) {
  const a = n.path ?? "/__sw__.js", d = a.replace(/^\/+/, "");
  return {
    name: "nodepod",
    configureServer(s) {
      s.middlewares.use(async (o, e, h) => {
        const r = o.url?.split("?")[0], f = String(o.headers?.host ?? "").replace(/:\d+$/, ""), H = /^.+-\d+\.localhost$/i.test(f) || /^.+-\d+\.preview\..+$/i.test(f), T = String(o.headers?.accept ?? "").includes("text/html"), y = o.headers?.["sec-fetch-mode"] === "navigate", l = H && !(r === a || r === "/__nodepod_bridge__.html" || r === "/__nodepod_bridge__.js" || r === m) && (r === "/" || y || T);
        if (r === m) {
          const t = await g(import.meta.url).catch(() => null);
          if (t === null) return h();
          e.setHeader("Content-Type", "application/javascript; charset=utf-8"), e.setHeader("Cache-Control", "no-cache"), e.statusCode = 200, e.end(t);
          return;
        }
        if (l || r === "/__nodepod_bridge__.html" || r === "/__nodepod_bridge__.js") {
          try {
            const t = l || r === "/__nodepod_bridge__.html", i = await _(import.meta.url, t ? "html" : "script"), c = t ? new URL(o.url ?? "", "http://nodepod.local").searchParams.get("mode") : null, p = R(t ? "text/html" : "application/javascript", l ? "top" : c === "top" || c === "parent" ? c : null);
            for (const [S, E] of Object.entries(p)) e.setHeader(S, E);
            e.statusCode = 200, e.end(i);
          } catch (t) {
            e.statusCode = 500, e.setHeader("Content-Type", "text/plain"), e.end(`[nodepod/vite] failed to read preview bridge: ${t instanceof Error ? t.message : String(t)}`);
          }
          return;
        }
        if (r !== a) return h();
        try {
          const t = await w(import.meta.url), i = P();
          for (const [c, p] of Object.entries(i)) e.setHeader(c, p);
          e.statusCode = 200, e.end(t);
        } catch (t) {
          e.statusCode = 500, e.setHeader("Content-Type", "text/plain");
          const i = t instanceof Error ? t.message : String(t);
          e.end(`[nodepod/vite] failed to read __sw__.js: ${i}`);
        }
      });
    },
    async generateBundle() {
      const s = await w(import.meta.url);
      this.emitFile({
        type: "asset",
        fileName: d,
        source: s
      }), this.emitFile({
        type: "asset",
        fileName: C.replace(/^\/+/, ""),
        source: await _(import.meta.url, "html")
      }), this.emitFile({
        type: "asset",
        fileName: j.replace(/^\/+/, ""),
        source: await _(import.meta.url, "script")
      });
      const o = await g(import.meta.url).catch(() => null);
      o !== null && this.emitFile({
        type: "asset",
        fileName: m.replace(/^\/+/, ""),
        source: o
      });
    }
  };
}
export {
  $ as default,
  $ as nodepod
};

//# sourceMappingURL=vite.mjs.map