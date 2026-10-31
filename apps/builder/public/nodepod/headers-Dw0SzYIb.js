import { dirname as p, resolve as l } from "node:path";
import { fileURLToPath as u } from "node:url";
import { readFile as c } from "node:fs/promises";
var f = [
  "../__sw__.js",
  "../../static/__sw__.js",
  "../../dist/__sw__.js"
], a = null;
async function g(o) {
  const r = p(u(o)), e = [];
  for (const _ of f) {
    const n = l(r, _);
    try {
      return await c(n), n;
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      e.push(`  ${n}: ${s}`);
    }
  }
  throw new Error(`[nodepod] could not locate __sw__.js. Tried:
${e.join(`
`)}`);
}
async function v(o) {
  return a || (a = (async () => {
    const r = await g(o);
    return c(r, "utf8");
  })()), a;
}
var h = {
  html: [
    "../__nodepod_bridge__.html",
    "../../static/__nodepod_bridge__.html",
    "../../dist/__nodepod_bridge__.html"
  ],
  script: [
    "../__nodepod_bridge__.js",
    "../../static/__nodepod_bridge__.js",
    "../../dist/__nodepod_bridge__.js"
  ]
}, d = /* @__PURE__ */ new Map();
function E(o, r) {
  let e = d.get(r);
  return e || (e = (async () => {
    const _ = p(u(o)), n = [];
    for (const t of h[r]) {
      const s = l(_, t);
      try {
        return await c(s, "utf8");
      } catch (i) {
        n.push(`  ${s}: ${i instanceof Error ? i.message : String(i)}`);
      }
    }
    throw new Error(`[nodepod] could not locate preview bridge ${r}. Tried:
${n.join(`
`)}`);
  })(), d.set(r, e)), e;
}
var j = "/__sw__.js", S = "/__nodepod_bridge__.html", b = "/__nodepod_bridge__.js";
function y() {
  return {
    "Content-Type": "application/javascript; charset=utf-8",
    "Service-Worker-Allowed": "/",
    "Cache-Control": "no-cache"
  };
}
function A(o, r) {
  const e = {
    "Content-Type": `${o}; charset=utf-8`,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "no-store"
  };
  return r === "top" ? e["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups" : r === "parent" && (e["Cross-Origin-Opener-Policy"] = "unsafe-none"), e;
}
export {
  y as a,
  A as i,
  b as n,
  E as o,
  j as r,
  v as s,
  S as t
};

//# sourceMappingURL=headers-Dw0SzYIb.js.map