import { d as O } from "./event-loop-CGuYUIBq.js";
import { a as K, i as U, n as D, o as N } from "./offload-DgyAYqvz.js";
import { B as z, F as B, M as P, P as L, a as R, n as H, p as W, t as v } from "./tarball-cache-__C0n2zb.js";
import { n as E } from "./registry-client-BDeaTBMb.js";
var X = 16, G = 512, y = /* @__PURE__ */ new Map(), M = [], g = 0;
function J() {
  return g < X ? (g++, Promise.resolve()) : new Promise((e) => M.push(() => {
    g++, e();
  }));
}
function Z() {
  g--, M.shift()?.();
}
async function j(e) {
  await J();
  try {
    try {
      const r = await v(), a = r ? await r.get(e) : null;
      if (a) return a;
    } catch {
    }
    return await E(e);
  } catch {
    return null;
  } finally {
    Z();
  }
}
function le(e) {
  !e || y.has(e) || y.size >= G || y.set(e, j(e));
}
function q(e) {
  const r = y.get(e);
  return r ? (y.delete(e), r) : null;
}
function fe(e) {
  for (const r of e) r && y.delete(r);
}
var de = /* @__PURE__ */ O({
  downloadAndExtract: () => ae,
  parseTarArchive: () => ne,
  safeJoin: () => C
}), Y = 20971520, $ = Promise.resolve();
async function Q(e) {
  const r = $;
  let a;
  $ = new Promise((t) => {
    a = t;
  }), await r;
  try {
    return await e();
  } finally {
    a();
  }
}
function _(e, r) {
  if (e.existsSync(r)) {
    if (!e.statSync(r).isDirectory()) {
      e.unlinkSync(r);
      return;
    }
    for (const a of e.readdirSync(r)) _(e, L(r, a));
    e.rmdirSync(r);
  }
}
function C(e, r) {
  const a = B(e).replace(/\/+$/, ""), t = B(L(a, r));
  return t === a || t.startsWith(a + "/") ? t : null;
}
function V(e, r, a) {
  const t = /^sha(256|384|512)-([A-Za-z0-9+/=]+)$/.exec(r.trim());
  if (!t) throw new Error(`Unsupported integrity algorithm for ${a}: ${r}`);
  const n = `SHA-${t[1]}`, s = t[2], i = R(n, new Uint8Array(e));
  let l = "";
  for (let o = 0; o < i.length; o++) l += String.fromCharCode(i[o]);
  const d = btoa(l);
  if (d !== s) throw new Error(`Integrity check failed for ${a}: expected ${r}, got ${n.toLowerCase().replace("-", "")}-${d}`);
}
var ee = null;
function k(e, r, a) {
  const t = Math.min(r + a, e.length);
  let n = r, s = !0;
  for (; n < t; ) {
    const i = e[n];
    if (i === 0) break;
    i >= 128 && (s = !1), n++;
  }
  return n === r ? "" : s ? String.fromCharCode.apply(null, e.subarray(r, n)) : (ee ??= new TextDecoder()).decode(e.slice(r, n));
}
function b(e, r, a) {
  const t = Math.min(r + a, e.length);
  let n = r;
  for (; n < t && (e[n] === 32 || e[n] >= 9 && e[n] <= 13); ) n++;
  let s = 1;
  n < t && (e[n] === 43 || e[n] === 45) && (e[n] === 45 && (s = -1), n++);
  let i = 0, l = 0;
  for (; n < t && e[n] >= 48 && e[n] <= 55; )
    i = i * 8 + (e[n] - 48), l++, n++;
  return l > 0 && s * i || 0;
}
function te(e, r, a) {
  for (let t = r; t < r + a; t++) if (e[t] !== 0) return !1;
  return !0;
}
function re(e) {
  switch (e) {
    case "0":
    case "\0":
    case "":
      return "file";
    case "5":
      return "directory";
    case "1":
    case "2":
      return "link";
    default:
      return "other";
  }
}
function* ne(e) {
  let a = 0;
  for (; a + 512 <= e.length; ) {
    const t = a;
    if (a += 512, te(e, t, 512)) break;
    const n = k(e, t, 100);
    if (!n) continue;
    const s = b(e, t + 100, 8), i = b(e, t + 124, 12), l = String.fromCharCode(e[t + 156]), d = k(e, t + 157, 100), o = k(e, t + 345, 155), h = o ? `${o}/${n}` : n, u = re(l);
    let p;
    u === "file" && (p = i > 0 ? e.slice(a, a + i) : /* @__PURE__ */ new Uint8Array(0)), i > 0 && (a += Math.ceil(i / 512) * 512), yield {
      filepath: h,
      kind: u,
      byteSize: i,
      fileMode: s,
      payload: p,
      linkDestination: u === "link" ? d : void 0
    };
  }
}
async function ae(e, r, a, t = {}) {
  if (!t.profiler) return F(e, r, a, t);
  const n = t.profiler?.begin("packages.extract", {
    category: "packages",
    metadata: { url: e }
  }) ?? null;
  try {
    return await F(e, r, a, t);
  } finally {
    t.profiler?.end(n);
  }
}
async function F(e, r, a, t) {
  t.onProgress?.(`Fetching ${e}...`);
  let n = null, s = null;
  const i = q(e);
  i && (n = await i);
  try {
    s = await v(), s && !n && (n = await s.get(e));
  } catch {
    s = null;
  }
  n || (n = await E(e)), t.expectedIntegrity && V(n, t.expectedIntegrity, e);
  const l = K(), d = `/.nodepod/install/${l}`, o = [];
  r.mkdirSync(d, { recursive: !0 });
  const h = new MessageChannel();
  let u;
  const p = new Promise((c) => {
    u = c;
  });
  h.port1.onmessage = (c) => {
    const f = c.data;
    if (f?.type === "done") {
      u();
      return;
    }
    f?.type !== "file" || !f.file || A(f.file);
  }, h.port1.start();
  const T = /* @__PURE__ */ new Set(), A = (c) => {
    if (t.filter && !t.filter(c.path)) return;
    const f = C(d, c.path), x = C(a, c.path);
    if (!f || !x) return;
    const S = P(f);
    T.has(S) || (r.mkdirSync(S, { recursive: !0 }), T.add(S));
    const m = c.data instanceof Uint8Array ? c.data : c.isBinary ? z(c.data) : c.data;
    r.writeFileSync(f, m), x.endsWith(".wasm") && m instanceof Uint8Array && W(m), o.push(x), t.onFile?.(c.path, m);
  };
  let w;
  const I = t.profiler?.begin("workers.extract", { category: "workers" }) ?? null;
  try {
    const c = {
      type: "extract",
      id: l,
      tarballUrl: e,
      stripComponents: t.stripComponents ?? 1,
      priority: N.NORMAL,
      expectedShasum: t.expectedShasum,
      tarballBytes: n,
      wantTarball: !1,
      streamPort: h.port2
    };
    if (w = await Q(() => t.profiler ? U(c, t.profiler) : D(c)), w.streamed) await p;
    else for (const f of w.files) A(f);
  } catch (c) {
    throw _(r, d), c;
  } finally {
    h.port1.close(), t.profiler?.end(I);
  }
  return s && n.byteLength > 0 && n.byteLength <= Y && H(n) && s.put(e, n, t.expectedShasum).catch(() => {
  }), r.mkdirSync(P(a), { recursive: !0 }), r.renameSync(d, a), t.onProgress?.(`Extracted ${o.length} files`), t.profiler?.count("packages.extractedFiles", o.length), o;
}
export {
  fe as i,
  ae as n,
  le as r,
  de as t
};

//# sourceMappingURL=archive-extractor-DntmdCI9.js.map