import { d as D } from "./event-loop-CGuYUIBq.js";
import { y as I } from "./config-CDCaUbLv.js";
var M = null, m = null, _ = !1, U = [
  "registry.npmjs.org",
  "github.com",
  "raw.githubusercontent.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "esm.sh",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "localhost",
  "127.0.0.1"
];
function p() {
  if (M) return M;
  try {
    return typeof localStorage < "u" ? localStorage.getItem("__corsProxyUrl") ?? null : null;
  } catch {
    return null;
  }
}
function Z(t) {
  M = t;
}
function L() {
  return p();
}
function tt(t) {
  if (t === null) {
    m = null, !_ && typeof console < "u" && console.warn && (_ = !0, console.warn("[nodepod] allowedFetchDomains is null — outbound fetch restrictions are disabled"));
    return;
  }
  m = /* @__PURE__ */ new Set([...U, ...t]);
}
function O() {
  return m ? [...m] : null;
}
function $(t) {
  if (!m) return !0;
  try {
    const e = new URL(t).hostname;
    for (const r of m) {
      const o = r === "localhost" || /^[0-9.]+$/.test(r) || r.includes(":");
      if (e === r || !o && e.endsWith("." + r)) return !0;
    }
    return !1;
  } catch {
    return !1;
  }
}
async function N(t, e) {
  const r = p();
  if (r) {
    if (!$(t)) throw new Error(`Fetch blocked: "${new URL(t).hostname}" is not in the allowedFetchDomains whitelist`);
    return fetch(r + encodeURIComponent(t), e);
  }
  return fetch(t, e);
}
function et(t) {
  const e = p();
  if (!e) return null;
  let r;
  try {
    r = new URL(t);
  } catch {
    return null;
  }
  return r.protocol !== "http:" && r.protocol !== "https:" || typeof location < "u" && r.origin === location.origin || t.startsWith(e) || !$(t) ? null : e + encodeURIComponent(t);
}
function rt() {
  return {
    proxy: p(),
    allowedDomains: O()
  };
}
function at(t) {
  const e = p();
  if (e && !$(t)) throw new Error(`Fetch blocked: "${new URL(t).hostname}" is not in the allowedFetchDomains whitelist`);
  return e ? e + encodeURIComponent(t) : t;
}
var v = 3e4, x = 9e4;
function j(t) {
  return t === 408 || t === 429 || t >= 500;
}
function q(t) {
  return t instanceof Error && (t.name === "AbortError" || t.name === "TimeoutError");
}
var g = class extends Error {
  url;
  status;
  attempts;
  constructor(t, e, r, o) {
    super(t), this.name = "RegistryFetchError", this.url = e, this.status = r, this.attempts = o;
  }
};
async function S(t, e) {
  const r = Math.max(1, e.attempts ?? 3), o = e.backoffMs ?? 500, s = e.fetchImpl ?? N, i = e.sleep ?? ((l) => new Promise((a) => setTimeout(a, l))), h = e.label ?? t, n = e.init?.signal ?? null;
  let c = "", d = null;
  for (let l = 1; l <= r; l++) {
    if (n?.aborted) throw new g(`${h}: request aborted`, t, null, l - 1);
    const a = new AbortController(), f = () => a.abort(n?.reason);
    n?.addEventListener("abort", f, { once: !0 });
    let A = !1, T = null;
    const R = new Promise((u, w) => {
      T = setTimeout(() => {
        A = !0, a.abort(), w(/* @__PURE__ */ new Error("deadline"));
      }, e.timeoutMs);
    });
    R.catch(() => {
    });
    try {
      const u = s(t, {
        ...e.init,
        signal: a.signal
      });
      u.catch(() => {
      });
      const w = await Promise.race([u, R]);
      if (!j(w.status)) return w;
      d = w.status, c = `HTTP ${w.status}`, await Promise.race([w.arrayBuffer().then(() => {
      }, () => {
      }), i(Math.min(e.timeoutMs, 2e3)).then(() => {
        w.body?.cancel().catch(() => {
        });
      })]);
    } catch (u) {
      if (n?.aborted) throw new g(`${h}: request aborted`, t, null, l);
      d = null, c = A ? `timed out after ${e.timeoutMs}ms` : q(u) ? "aborted" : u instanceof Error ? u.message : String(u);
    } finally {
      T && clearTimeout(T), n?.removeEventListener("abort", f);
    }
    l < r && await i(o * 2 ** (l - 1));
  }
  throw new g(`${h}: ${c} (after ${r} attempt${r === 1 ? "" : "s"})`, t, d, r);
}
async function P(t, e, r) {
  let o = null;
  const s = new Promise((h, n) => {
    o = setTimeout(() => {
      n(new g(`${r}: body read timed out after ${e}ms`, t.url, t.status, 1));
      try {
        t.body?.cancel().catch(() => {
        });
      } catch {
      }
    }, e);
  });
  s.catch(() => {
  });
  const i = t.arrayBuffer();
  i.catch(() => {
  });
  try {
    return await Promise.race([i, s]);
  } finally {
    o && clearTimeout(o);
  }
}
var ot = /* @__PURE__ */ D({
  RegistryClient: () => C,
  default: () => C,
  downloadTarball: () => k,
  flushSharedRegistryCache: () => J
}), H = I, W = "nodepod-registry-v1", B = 216e5, G = 256, V = 6e4, y = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new Map();
function F(t, e) {
  for (y.delete(t), y.set(t, e); y.size > G; ) {
    const r = y.keys().next().value;
    if (r === void 0) break;
    y.delete(r);
  }
}
var b = null;
function Y() {
  return typeof caches > "u" ? Promise.resolve(null) : (b || (b = caches.open(W).catch(() => (b = null, null))), b);
}
var X = new TextDecoder();
function z(t) {
  return t.replace(/\//g, "%2f");
}
var C = class {
  baseUrl;
  metadataStore;
  notFound = /* @__PURE__ */ new Map();
  profiler;
  constructor(t = {}) {
    this.baseUrl = (t.endpoint || H).replace(/\/+$/, ""), this.metadataStore = t.metadataCache || /* @__PURE__ */ new Map(), this.profiler = t.profiler ?? null;
  }
  async fetchManifest(t) {
    const e = this.metadataStore.get(t);
    if (e) return e;
    const r = `${this.baseUrl}/${z(t)}`, o = `${this.baseUrl}|${t}`, s = y.get(o);
    if (s)
      return this.metadataStore.set(t, s), s;
    const i = this.notFound.get(t);
    if (i && Date.now() - i.at < V) throw i.error;
    const h = E.get(o);
    if (h) return h;
    const n = this.fetchAndCacheManifest(t, r, o);
    E.set(o, n);
    try {
      return await n;
    } catch (c) {
      throw c instanceof Error && c.message.endsWith("does not exist in the registry") && this.notFound.set(t, {
        error: c,
        at: Date.now()
      }), c;
    } finally {
      E.delete(o);
    }
  }
  async fetchAndCacheManifest(t, e, r) {
    const o = this.profiler?.begin("packages.registry.fetchManifest", {
      category: "packages",
      metadata: { packageName: t }
    }) ?? null;
    try {
      return await this.fetchAndCacheManifestInternal(t, e, r);
    } finally {
      this.profiler?.end(o);
    }
  }
  async fetchAndCacheManifestInternal(t, e, r) {
    const o = await Y(), s = o ? await o.match(e).catch(() => {
    }) : void 0, i = Number(s?.headers.get("x-nodepod-stored-at") ?? 0);
    if (s && i > 0 && Date.now() - i < B) {
      const a = await s.json();
      return this.metadataStore.set(t, a), F(r, a), a;
    }
    const h = { headers: { Accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8" } };
    let n, c = null;
    try {
      if (n = await S(e, {
        timeoutMs: v,
        init: h,
        label: `registry metadata for "${t}"`
      }), n.status === 404 && L()) try {
        n = await S(e, {
          timeoutMs: v,
          init: h,
          label: `registry metadata for "${t}"`,
          fetchImpl: (a, f) => fetch(a, f)
        });
      } catch (a) {
        c = a instanceof Error ? a.message : String(a);
      }
    } catch (a) {
      const f = a instanceof Error ? a.message : String(a);
      throw new Error(`Failed to fetch package "${t}" from the registry (${f}). The package may not exist, or the registry blocked the browser request.`);
    }
    if (n.status === 404)
      throw c ? new Error(`Configured CORS proxy returned HTTP 404 for package "${t}"; the direct registry request also failed (${c}).`) : new Error(`Package "${t}" does not exist in the registry`);
    if (!n.ok) throw new Error(`Registry request for "${t}" failed with HTTP ${n.status}`);
    let d, l;
    try {
      l = await P(n, v, `registry metadata for "${t}"`), d = JSON.parse(X.decode(l));
    } catch (a) {
      const f = a instanceof Error ? a.message : String(a);
      throw new Error(`Registry metadata for "${t}" could not be read (${f})`);
    }
    if (!d || typeof d != "object" || !d.versions) throw new Error(`Registry metadata for "${t}" is malformed`);
    if (this.metadataStore.set(t, d), F(r, d), o) {
      const a = new Headers(n.headers);
      a.set("content-type", "application/json"), a.set("x-nodepod-stored-at", String(Date.now())), o.put(e, new Response(l, {
        status: 200,
        headers: a
      })).catch(() => {
      });
    }
    return d;
  }
  async fetchVersion(t, e) {
    const r = await this.fetchManifest(t), o = r["dist-tags"][e] || e, s = r.versions[o];
    if (!s) throw new Error(`Version "${e}" does not exist for package "${t}"`);
    return s;
  }
  async getLatestVersion(t) {
    return (await this.fetchManifest(t))["dist-tags"].latest;
  }
  async listVersions(t) {
    const e = await this.fetchManifest(t);
    return Object.keys(e.versions);
  }
  async getTarballUrl(t, e) {
    return (await this.fetchVersion(t, e)).dist.tarball;
  }
  async downloadArchive(t) {
    const e = this.profiler?.begin("packages.registry.download", {
      category: "packages",
      metadata: { url: t }
    }) ?? null;
    try {
      return await k(t);
    } finally {
      this.profiler?.end(e);
    }
  }
  flushCache() {
    this.metadataStore.clear();
  }
};
async function k(t) {
  let e;
  try {
    e = await S(t, {
      timeoutMs: x,
      label: "tarball download"
    });
  } catch (r) {
    const o = r instanceof Error ? r.message : String(r);
    throw new Error(`Tarball download failed (${o}): ${t}`);
  }
  if (!e.ok) throw new Error(`Tarball download failed (HTTP ${e.status}): ${t}`);
  try {
    return await P(e, x, "tarball download");
  } catch (r) {
    throw r instanceof g ? new Error(`Tarball download failed (${r.message}): ${t}`) : r;
  }
}
function J() {
  y.clear(), E.clear();
}
export {
  rt as a,
  et as c,
  Z as d,
  ot as i,
  at as l,
  k as n,
  L as o,
  J as r,
  N as s,
  C as t,
  tt as u
};

//# sourceMappingURL=registry-client-BDeaTBMb.js.map