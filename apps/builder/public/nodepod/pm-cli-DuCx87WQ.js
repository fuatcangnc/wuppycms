import { t as ce } from "./fast-pako-BwXotfTx.js";
import { t as ae } from "./tarball-cache-__C0n2zb.js";
import "./config-BBz1Tu7H.js";
import { r as ue, s as J, t as q } from "./registry-client-BV27YIBO.js";
function qe(e) {
  let t = 3735928559, n = 1103547991;
  for (let s = 0; s < e.length; s++) {
    const r = e.charCodeAt(s);
    t = Math.imul(t ^ r, 2654435761), n = Math.imul(n ^ r, 1597334677);
  }
  return t = Math.imul(t ^ t >>> 16, 2246822507) ^ Math.imul(n ^ n >>> 13, 3266489909), n = Math.imul(n ^ n >>> 16, 2246822507) ^ Math.imul(t ^ t >>> 13, 3266489909), (4294967296 * (2097151 & n) + (t >>> 0)).toString(36);
}
function Be(e) {
  let t = 0;
  for (let n = 0; n < e.length; n++)
    t = (t << 5) - t + e.charCodeAt(n), t |= 0;
  return t.toString(36);
}
var le = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/, M = /* @__PURE__ */ new Map(), fe = 2e5;
function N(e) {
  const t = M.get(e);
  if (t !== void 0) return t;
  const n = e.match(le), s = n ? {
    major: Number(n[1]),
    minor: Number(n[2]),
    patch: Number(n[3]),
    prerelease: n[4]
  } : null;
  return M.size >= fe && M.clear(), M.set(e, s), s;
}
function w(e, t) {
  const n = N(e), s = N(t);
  if (!n || !s) return e.localeCompare(t);
  const r = n.major - s.major;
  if (r !== 0) return r;
  const i = n.minor - s.minor;
  if (i !== 0) return i;
  const o = n.patch - s.patch;
  return o !== 0 ? o : n.prerelease && !s.prerelease ? -1 : !n.prerelease && s.prerelease ? 1 : n.prerelease && s.prerelease ? pe(n.prerelease, s.prerelease) : 0;
}
var R = /* @__PURE__ */ new Map(), de = 5e4;
function U(e) {
  let t = R.get(e);
  return t === void 0 && (t = e.split(".").map((n) => /^\d+$/.test(n) ? Number(n) : n), R.size >= de && R.clear(), R.set(e, t)), t;
}
function pe(e, t) {
  if (e === t) return 0;
  const n = U(e), s = U(t), r = Math.max(n.length, s.length);
  for (let i = 0; i < r; i++) {
    if (i >= n.length) return -1;
    if (i >= s.length) return 1;
    const o = n[i], c = s[i];
    if (o === c) continue;
    const l = typeof o == "number", a = typeof c == "number";
    if (l && a) {
      const u = o - c;
      if (u !== 0) return u;
    } else {
      if (l !== a) return l ? -1 : 1;
      {
        const u = o.localeCompare(c);
        if (u !== 0) return u;
      }
    }
  }
  return 0;
}
function O(e, t) {
  const n = N(e);
  if (!n || n.prerelease && !(t.match(/\d+\.\d+\.\d+(?:-[^\s)]*)?/g) || []).some((r) => {
    if (!r.includes("-")) return !1;
    const i = N(r);
    return i && i.major === n.major && i.minor === n.minor && i.patch === n.patch;
  }))
    return !1;
  if (t = t.trim(), t === "*" || t === "latest" || t === "") return !0;
  if (t.includes("||")) return t.split("||").some((r) => O(e, r.trim()));
  if (t.includes(" - ")) {
    const [r, i] = t.split(" - ").map((o) => o.trim());
    return w(e, r) >= 0 && w(e, i) <= 0;
  }
  const s = t.match(/(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?(?:\.\d+)?(?:-[^\s]*)?)/g);
  if (s && s.length > 1) return s.every((r) => {
    const i = r.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?(?:\.\d+)?(?:-[^\s]*)?)$/);
    if (!i) return !0;
    const o = i[1];
    let c = i[2];
    const l = (c.match(/\./g) || []).length;
    return l === 0 ? c += ".0.0" : l === 1 && (c += ".0"), me(e, o, c);
  });
  if (t.startsWith("^")) {
    const r = j(t.slice(1).trim()), i = N(r);
    return !i || n.major !== i.major || i.major === 0 && (i.minor !== 0 && n.minor !== i.minor || i.minor === 0 && (n.minor !== 0 || n.patch !== i.patch)) ? !1 : w(e, r) >= 0;
  }
  if (t.startsWith("~")) {
    const r = t.slice(1).trim(), i = r.replace(/[xX*]/g, "0").split("."), o = j(r), c = N(o);
    return c ? i.length === 1 ? n.major === c.major && w(e, o) >= 0 : n.major === c.major && n.minor === c.minor && w(e, o) >= 0 : !1;
  }
  if (t.startsWith(">=")) return w(e, j(t.slice(2).trim())) >= 0;
  if (t.startsWith(">")) return w(e, j(t.slice(1).trim())) > 0;
  if (t.startsWith("<=")) return w(e, j(t.slice(2).trim())) <= 0;
  if (t.startsWith("<")) return w(e, j(t.slice(1).trim())) < 0;
  if (t.startsWith("=")) return w(e, j(t.slice(1).trim())) === 0;
  if (t.includes("x") || t.includes("X") || t.includes("*") || /^\d+$/.test(t) || /^\d+\.\d+$/.test(t)) {
    const r = t.replace(/[xX*]/g, "").split(".").filter(Boolean);
    if (r.length === 1) return n.major === Number(r[0]);
    if (r.length === 2) return n.major === Number(r[0]) && n.minor === Number(r[1]);
  }
  if (t.includes(" ")) return t.split(/\s+/).filter(Boolean).every((r) => O(e, r));
  if (/^\d+\.\d+\.\d+/.test(t)) {
    const r = t.match(/^(\d+\.\d+\.\d+(?:-[^\s]+)?)/);
    if (r) return w(e, r[1]) === 0;
  }
  return w(e, t) === 0;
}
function j(e) {
  const t = e.replace(/[xX*]/g, "0").split(".");
  for (; t.length < 3; ) t.push("0");
  return t.join(".");
}
function me(e, t, n) {
  const s = w(e, n);
  switch (t) {
    case ">=":
      return s >= 0;
    case "<=":
      return s <= 0;
    case ">":
      return s > 0;
    case "<":
      return s < 0;
    default:
      return s === 0;
  }
}
function he(e, t) {
  return X([...e].sort((n, s) => w(s, n)), t);
}
function X(e, t) {
  for (const n of e) if (O(n, t)) return n;
  return null;
}
var V = /* @__PURE__ */ new WeakMap();
function K(e, t) {
  let n = V.get(e.versions);
  return n || (n = Object.keys(e.versions).sort((s, r) => w(r, s)), V.set(e.versions, n)), X(n, t);
}
function B(e) {
  if (!e.startsWith("npm:")) return null;
  const t = e.slice(4);
  let n;
  return t.startsWith("@") ? n = t.indexOf("@", 1) : n = t.indexOf("@"), n === -1 ? {
    realName: t,
    realRange: "latest"
  } : {
    realName: t.slice(0, n),
    realRange: t.slice(n + 1)
  };
}
function Y(e, t) {
  return {
    registry: e,
    completed: /* @__PURE__ */ new Map(),
    rootPromises: /* @__PURE__ */ new Map(),
    placementPromises: /* @__PURE__ */ new Map(),
    config: t
  };
}
async function Ie(e, t = "latest", n = {}) {
  const s = n.registry || new q(), r = Y(s, n);
  return await Q(s, [[e, t]], n), await E(e, t, r), r.completed;
}
var ge = 24;
function ye(e, t) {
  return t === "latest" || t === "*" ? e["dist-tags"].latest ?? null : e["dist-tags"][t] ? e["dist-tags"][t] : K(e, t);
}
function Q(e, t, n) {
  const s = /* @__PURE__ */ new Set(), r = t.slice();
  let i = 0;
  return new Promise((o) => {
    const c = (a, u) => {
      const f = u.peerDependenciesMeta || {};
      for (const [m, d] of Object.entries(u.peerDependencies || {})) f[m]?.optional || r.push([m, d]);
      for (const m of Object.entries(u.dependencies || {})) r.push(m);
      const p = u.optionalDependencies || {}, h = Object.keys(p);
      if (n.optionalDependencies) for (const m of Object.entries(p)) r.push(m);
      else {
        const m = h.filter((d) => d.includes("wasm32-wasi") || d.includes("wasm"));
        for (const d of m) r.push([d, p[d]]);
        if (m.length === 0 && h.length >= 2) {
          const d = /-(darwin|linux|win32|freebsd|android|sunos)-(x64|x86|arm64|arm|ia32|s390x|ppc64|mips|riscv)/;
          h.every(($) => d.test($)) && r.push([a + "-wasm32-wasi", "*"], [a + "-wasm", "*"]);
        }
      }
    }, l = () => {
      for (; i < ge && r.length > 0; ) {
        const [a, u] = r.shift();
        let f, p;
        try {
          if (typeof u != "string") continue;
          const d = B(u);
          f = d?.realName ?? a, p = d?.realRange ?? u;
        } catch {
          continue;
        }
        const h = `${f}@${p}`;
        if (s.has(h)) continue;
        s.add(h), i++;
        let m;
        try {
          m = e.fetchManifest(f);
        } catch (d) {
          m = Promise.reject(d);
        }
        m.then((d) => {
          const $ = ye(d, p), b = $ ? d.versions[$] : void 0;
          b && c(a, b);
        }).catch(() => {
        }).finally(() => {
          i--, l();
        });
      }
      i === 0 && r.length === 0 && o();
    };
    l();
  });
}
async function Ge(e, t = {}) {
  const n = t.registry || new q(), s = Y(n, t), r = { ...e.dependencies };
  t.devDependencies && e.devDependencies && Object.assign(r, e.devDependencies);
  const i = t.optionalDependencies && e.optionalDependencies ? Object.entries(e.optionalDependencies) : [], o = Object.entries(r);
  await Q(n, [...o, ...i], t);
  for (const [c, l] of o) await E(c, l, s, "", { walkEdges: !1 });
  for (const [c, l] of i) try {
    await E(c, l, s, "", { walkEdges: !1 });
  } catch {
  }
  for (const [c] of o) await H(c, s);
  for (const [c] of i) try {
    await H(c, s);
  } catch {
  }
  return s.completed;
}
async function E(e, t, n, s = "", r = {}) {
  const i = r.walkEdges !== !1, { rootPromises: o, placementPromises: c, completed: l } = n, a = B(t), u = e, f = a?.realName ?? e;
  t = a?.realRange ?? t;
  const p = o.get(u);
  if (!p) {
    const _ = u, k = we();
    o.set(u, k.promise);
    try {
      const S = await L(_, f, u, t, n, i);
      k.resolve(S);
    } catch (S) {
      throw o.delete(u), k.reject(S), k.promise.catch(() => {
      }), S;
    }
    return;
  }
  let h;
  const m = l.get(u);
  if (m) h = m;
  else try {
    h = await p;
  } catch {
    return;
  }
  if (O(h.version, t) || !s) return;
  const d = `${s}/node_modules/${u}`, $ = c.get(d);
  if ($) {
    await $;
    return;
  }
  if (l.has(d))
    return O(l.get(d).version, t), void 0;
  const b = L(d, f, u, t, n);
  c.set(d, b.then(() => {
  })), await b;
}
function we() {
  let e, t;
  return {
    promise: new Promise((n, s) => {
      e = n, t = s;
    }),
    resolve: e,
    reject: t
  };
}
async function L(e, t, n, s, r, i = !0) {
  const { registry: o, completed: c, config: l } = r, a = c.get(e);
  if (a) return a;
  l.onProgress?.(`Resolving ${t}@${s}`);
  const u = await o.fetchManifest(t);
  let f;
  if (s === "latest" || s === "*") f = u["dist-tags"].latest;
  else if (u["dist-tags"][s]) f = u["dist-tags"][s];
  else {
    const m = K(u, s);
    if (!m) throw new Error(`Could not find a version of "${t}" matching "${s}"`);
    f = m;
  }
  const p = u.versions[f], h = {
    name: n,
    fetchName: t,
    version: f,
    tarballUrl: p.dist.tarball,
    dependencies: p.dependencies || {},
    shasum: p.dist.shasum
  };
  return c.set(e, h), l.onResolved?.(h), i && await Z(e, n, p, r), h;
}
async function H(e, t) {
  const n = t.completed.get(e);
  if (!n) return;
  const s = (await t.registry.fetchManifest(n.fetchName)).versions[n.version];
  s && await Z(e, n.name, s, t);
}
async function z(e, t, n, s) {
  try {
    await E(e, t, n, s);
  } catch {
  }
}
async function Z(e, t, n, s) {
  const r = {}, i = {};
  if (n.peerDependencies) {
    const a = n.peerDependenciesMeta || {};
    for (const [u, f] of Object.entries(n.peerDependencies)) a[u]?.optional || (r[u] = f);
  }
  if (n.dependencies && Object.assign(r, n.dependencies), n.optionalDependencies) {
    const a = Object.entries(n.optionalDependencies);
    if (s.config.optionalDependencies) for (const [u, f] of a) i[u] = f;
    else {
      const u = Object.keys(n.optionalDependencies);
      let f = !1;
      for (const [p, h] of Object.entries(n.optionalDependencies)) (p.includes("wasm32-wasi") || p.includes("wasm")) && (i[p] = h, f = !0);
      if (!f && u.length >= 2) {
        const p = /-(darwin|linux|win32|freebsd|android|sunos)-(x64|x86|arm64|arm|ia32|s390x|ppc64|mips|riscv)/;
        if (u.every((h) => p.test(h))) {
          const h = [t + "-wasm32-wasi", t + "-wasm"];
          await Promise.all(h.map(async (m) => {
            await z(m, "*", s, e);
          }));
        }
      }
    }
  }
  const o = Object.entries(r), c = 8;
  for (let a = 0; a < o.length; a += c) {
    const u = o.slice(a, a + c);
    await Promise.all(u.map(([f, p]) => E(f, p, s, e)));
  }
  const l = Object.entries(i);
  for (let a = 0; a < l.length; a += c) {
    const u = l.slice(a, a + c);
    await Promise.all(u.map(([f, p]) => z(f, p, s, e)));
  }
  await ke(e, {
    ...r,
    ...i
  }, s);
}
function x(e, t, n) {
  let s = e;
  for (; s; ) {
    const r = `${s}/node_modules/${t}`;
    if (n.has(r)) return r;
    const i = s.lastIndexOf("/node_modules/");
    s = i < 0 ? "" : s.slice(0, i);
  }
  return n.has(t) ? t : void 0;
}
async function ke(e, t, n) {
  const { completed: s, registry: r } = n;
  for (const [i, o] of Object.entries(t)) {
    const c = x(e, i, s);
    if (!c || c.startsWith(`${e}/node_modules/`)) continue;
    const l = s.get(c);
    let a;
    try {
      a = (await r.fetchManifest(l.fetchName)).versions[l.version];
    } catch {
      continue;
    }
    if (!Object.keys(a?.peerDependencies || {}).some((m) => {
      const d = x(e, m, s);
      return d !== void 0 && d !== x(c, m, s);
    })) continue;
    const u = `${e}/node_modules/${i}`, f = n.placementPromises.get(u);
    if (f) {
      await f;
      continue;
    }
    if (s.has(u)) continue;
    const p = B(o), h = L(u, p?.realName ?? l.fetchName, i, p ? p.realRange : l.version, n);
    n.placementPromises.set(u, h.then(() => {
    }));
    try {
      await h;
    } catch {
    }
  }
}
var ee = "nodepod-resolution-v1", $e = 216e5, te = 1, F = /* @__PURE__ */ new Map(), T = /* @__PURE__ */ new Map();
function ne(e) {
  return new Request(`https://nodepod.invalid/resolution/${encodeURIComponent(e)}`);
}
function A(e) {
  return new Map([...e].map(([t, n]) => [t, {
    ...n,
    dependencies: { ...n.dependencies }
  }]));
}
async function be(e) {
  if (typeof caches > "u") return null;
  try {
    const t = await (await caches.open(ee)).match(ne(e));
    if (!t) return null;
    const n = await t.json();
    return n.schema !== te || !Array.isArray(n.entries) || !n.createdAt || Date.now() - n.createdAt > $e ? null : new Map(n.entries);
  } catch {
    return null;
  }
}
async function Se(e, t) {
  if (!(typeof caches > "u"))
    try {
      await (await caches.open(ee)).put(ne(e), new Response(JSON.stringify({
        schema: te,
        createdAt: Date.now(),
        entries: [...t]
      }), { headers: { "content-type": "application/json" } }));
    } catch {
    }
}
async function Ue(e, t) {
  const n = F.get(e);
  if (n) return {
    tree: A(n),
    hit: !0
  };
  const s = await be(e);
  if (s)
    return F.set(e, s), {
      tree: A(s),
      hit: !0
    };
  let r = T.get(e);
  const i = !!r;
  r || (r = t(), T.set(e, r));
  try {
    const o = await r;
    return F.set(e, A(o)), i || await Se(e, o), {
      tree: A(o),
      hit: i
    };
  } finally {
    i || T.delete(e);
  }
}
function je() {
  F.clear(), T.clear();
}
function v(e, t) {
  return e.toString(8).padStart(t - 1, "0") + "\0";
}
function Oe(e) {
  let t = 0;
  for (let n = 0; n < 512; n++) t += e[n];
  return t;
}
function ve(e, t, n, s) {
  const r = /* @__PURE__ */ new Uint8Array(512), i = new TextEncoder(), o = i.encode(e.slice(0, 100));
  r.set(o, 0), r.set(i.encode(v(n, 8)), 100), r.set(i.encode(v(0, 8)), 108), r.set(i.encode(v(0, 8)), 116), r.set(i.encode(v(t, 12)), 124), r.set(i.encode(v(Math.floor(s / 1e3), 12)), 136), r.set(i.encode("        "), 148), r[156] = 48, r.set(i.encode("ustar\0"), 257), r.set(i.encode("00"), 263);
  const c = v(Oe(r), 7) + " ";
  return r.set(i.encode(c.slice(0, 8)), 148), r;
}
function Ne(e) {
  const t = [], n = Date.now();
  for (const o of e) {
    const c = typeof o.content == "string" ? new TextEncoder().encode(o.content) : o.content, l = o.path.replace(/^\//, "");
    t.push(ve(l, c.length, o.mode ?? 420, o.mtime ?? n)), t.push(c);
    const a = (512 - c.length % 512) % 512;
    a && t.push(new Uint8Array(a));
  }
  t.push(/* @__PURE__ */ new Uint8Array(1024));
  let s = 0;
  for (const o of t) s += o.length;
  const r = new Uint8Array(s);
  let i = 0;
  for (const o of t)
    r.set(o, i), i += o.length;
  return r;
}
function _e(e) {
  return ce.gzip(Ne(e));
}
var g = (e = "", t = 0) => ({
  stdout: e,
  stderr: "",
  exitCode: t
}), y = (e, t = 1) => ({
  stdout: "",
  stderr: e,
  exitCode: t
}), se = "/usr/local", P = `${se}/lib`, C = `${se}/bin`, re = (e) => e === "-g" || e === "--global" || e === "--location=global";
function Ve(e) {
  return e.some(re);
}
function He(e) {
  return e.filter((t) => !re(t));
}
function ze(e, t) {
  const n = `${P}/package.json`;
  return e.existsSync(n) || (e.mkdirSync(P, { recursive: !0 }), e.writeFileSync(n, JSON.stringify({
    name: "nodepod-global",
    private: !0,
    dependencies: {}
  }, null, 2) + `
`)), {
    ...t,
    cwd: P
  };
}
function ie(e, t) {
  const n = `${P}/node_modules/${t}`;
  try {
    const s = JSON.parse(e.readFileSync(`${n}/package.json`, "utf8")), r = typeof s.bin == "string" ? { [String(s.name || t).split("/").pop()]: s.bin } : s.bin && typeof s.bin == "object" ? s.bin : {};
    return Object.entries(r).filter(([i, o]) => typeof o == "string" && /^[\w.@-]+$/.test(i)).map(([i, o]) => [i, `${n}/${o.replace(/^\.\//, "")}`]);
  } catch {
    return [];
  }
}
function Xe(e, t) {
  const n = [];
  for (const [s, r] of ie(e, t))
    e.mkdirSync(C, { recursive: !0 }), e.writeFileSync(`${C}/${s}`, `node "${r}" "$@"
`), n.push(s);
  return n;
}
function Ke(e, t) {
  const n = `${P}/node_modules/${t}/`;
  for (const [s] of ie(e, t)) {
    const r = `${C}/${s}`;
    try {
      e.readFileSync(r, "utf8").includes(`"${n}`) && e.unlinkSync(r);
    } catch {
    }
  }
}
function I(e, t) {
  const n = {}, s = [`${t}/.npmrc`, "/home/user/.npmrc"];
  for (const r of s) try {
    if (!e.existsSync(r)) continue;
    const i = e.readFileSync(r, "utf8");
    for (const o of i.split(`
`)) {
      const c = o.trim();
      if (!c || c.startsWith("#") || c.startsWith(";")) continue;
      const l = c.indexOf("=");
      l <= 0 || (n[c.slice(0, l).trim()] = c.slice(l + 1).trim());
    }
  } catch {
  }
  return n;
}
function Pe(e, t, n, s) {
  const r = `${t}/.npmrc`;
  let i = [];
  try {
    e.existsSync(r) && (i = e.readFileSync(r, "utf8").split(`
`));
  } catch {
  }
  let o = !1;
  const c = i.map((a) => {
    const u = a.trim();
    if (!u || u.startsWith("#") || u.startsWith(";")) return a;
    const f = u.indexOf("=");
    return f > 0 && u.slice(0, f).trim() === n ? (o = !0, `${n}=${s}`) : a;
  });
  o || c.push(`${n}=${s}`);
  const l = r.substring(0, r.lastIndexOf("/"));
  l && l !== "/" && !e.existsSync(l) && e.mkdirSync(l, { recursive: !0 }), e.writeFileSync(r, c.filter((a, u, f) => !(a === "" && u === f.length - 1)).join(`
`) + `
`);
}
function Ee(e, t, n) {
  const s = `${t}/.npmrc`;
  if (!e.existsSync(s)) return;
  const r = e.readFileSync(s, "utf8").split(`
`).filter((i) => {
    const o = i.trim();
    if (!o || o.startsWith("#") || o.startsWith(";")) return !0;
    const c = o.indexOf("=");
    return !(c > 0 && o.slice(0, c).trim() === n);
  });
  e.writeFileSync(s, r.join(`
`));
}
function D(e, t, n) {
  const s = I(e, t);
  return (n.npm_config_registry || s.registry || "https://registry.npmjs.org/").replace(/\/+$/, "");
}
function De(e, t, n, s) {
  if (n.NPM_TOKEN) return n.NPM_TOKEN;
  if (n.NODE_AUTH_TOKEN) return n.NODE_AUTH_TOKEN;
  const r = I(e, t);
  if (r["//registry.npmjs.org/:_authToken"]) return r["//registry.npmjs.org/:_authToken"];
  try {
    const i = `//${new URL(s.endsWith("/") ? s : s + "/").host}/:_authToken`;
    if (r[i]) return r[i];
  } catch {
  }
  return r._authToken;
}
function Ye(e, t, n) {
  const s = t[0], r = I(e, n.cwd), i = D(e, n.cwd, n.env);
  if (!s || s === "list") {
    let o = `; nodepod project config
`;
    o += `prefix = "${n.cwd}"
`, o += `registry = "${i}/"
`;
    for (const [c, l] of Object.entries(r))
      c !== "registry" && (o += `${c} = ${l}
`);
    return g(o);
  }
  if (s === "get") {
    const o = t[1];
    return o ? o === "prefix" ? g(n.cwd + `
`) : o === "registry" ? g(i + `/
`) : r[o] !== void 0 ? g(r[o] + `
`) : g(`undefined
`) : y(`npm config get requires a key
`);
  }
  if (s === "set") {
    const o = t[1], c = t.slice(2).join(" ");
    return !o || !c ? y(`npm config set requires <key> <value>
`) : (Pe(e, n.cwd, o, c), g());
  }
  if (s === "delete" || s === "rm" || s === "remove") {
    const o = t[1];
    return o ? (Ee(e, n.cwd, o), g()) : y(`npm config delete requires a key
`);
  }
  return y(`config: unknown subcommand "${s}"
`);
}
function Me(e, t) {
  const n = t.split(".");
  let s = e;
  for (const r of n) {
    if (s == null || typeof s != "object") return;
    s = s[r];
  }
  return s;
}
function Re(e, t, n) {
  const s = t.split(".");
  let r = e;
  for (let i = 0; i < s.length - 1; i++)
    (r[s[i]] == null || typeof r[s[i]] != "object") && (r[s[i]] = {}), r = r[s[i]];
  r[s[s.length - 1]] = n;
}
function Ae(e, t) {
  const n = t.split(".");
  let s = e;
  for (let i = 0; i < n.length - 1; i++) {
    if (s == null || typeof s != "object") return !1;
    s = s[n[i]];
  }
  if (s == null || typeof s != "object") return !1;
  const r = n[n.length - 1];
  return r in s ? (delete s[r], !0) : !1;
}
function Fe(e) {
  if (e === "true") return !0;
  if (e === "false") return !1;
  if (e === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  try {
    return JSON.parse(e);
  } catch {
    return e;
  }
}
function Qe(e, t, n) {
  const s = t[0], r = `${n.cwd}/package.json`;
  if (!e.existsSync(r)) return y(`npm pkg: no package.json found
`);
  let i;
  try {
    i = JSON.parse(e.readFileSync(r, "utf8"));
  } catch (o) {
    return y(`npm pkg: ${o?.message || "invalid package.json"}
`);
  }
  if (s === "get") {
    const o = t[1];
    if (!o) return g(JSON.stringify(i, null, 2) + `
`);
    const c = Me(i, o);
    return g(c === void 0 ? `undefined
` : typeof c == "string" ? c + `
` : JSON.stringify(c, null, 2) + `
`);
  }
  if (s === "set") {
    const o = t.slice(1);
    if (o.length === 0) return y(`npm pkg set requires key=value
`);
    for (const c of o) {
      const l = c.indexOf("=");
      if (l <= 0) return y(`npm pkg set: invalid argument '${c}'
`);
      const a = c.slice(0, l), u = Fe(c.slice(l + 1));
      Re(i, a, u);
    }
    return e.writeFileSync(r, JSON.stringify(i, null, 2) + `
`), g();
  }
  if (s === "delete" || s === "rm" || s === "remove") {
    const o = t.slice(1);
    if (o.length === 0) return y(`npm pkg delete requires a key
`);
    for (const c of o) Ae(i, c);
    return e.writeFileSync(r, JSON.stringify(i, null, 2) + `
`), g();
  }
  return y(`npm pkg: unknown subcommand "${s ?? ""}"
`);
}
async function Ze() {
  ue(), je();
  try {
    typeof caches < "u" && (await caches.delete("nodepod-registry-v1"), await caches.delete("nodepod-resolution-v1"));
  } catch {
  }
  try {
    await (await ae())?.clear?.();
  } catch {
  }
  return g(`Cache cleared.
`);
}
async function et(e, t) {
  const n = D(e, t.cwd, t.env), s = `${n}/-/ping`, r = Date.now();
  try {
    const i = await J(s), o = Date.now() - r;
    return i.ok ? g(`npm notice PING ${n}/
npm notice PONG ${o}ms
`) : y(`npm ping: registry returned HTTP ${i.status}
`);
  } catch (i) {
    return y(`npm ping: ${i?.message || "network error"}
`);
  }
}
async function tt(e, t) {
  const n = D(e, t.cwd, t.env), s = De(e, t.cwd, t.env, n);
  if (!s) return y(`npm whoami: not authenticated (set NPM_TOKEN or //registry...:_authToken in .npmrc)
`);
  try {
    const r = await J(`${n}/-/whoami`, { headers: { Authorization: `Bearer ${s}` } });
    if (r.status === 401 || r.status === 403) return y(`npm whoami: unauthorized
`);
    if (!r.ok) return y(`npm whoami: HTTP ${r.status}
`);
    const i = await r.json(), o = i.username || i.name;
    return o ? g(o + `
`) : y(`npm whoami: empty response
`);
  } catch (r) {
    return y(`npm whoami: ${r?.message || "network error"}
`);
  }
}
function G(e, t) {
  const n = `${t}/node_modules`, s = [];
  if (!e.existsSync(n)) return s;
  const r = (i, o) => {
    try {
      for (const c of e.readdirSync(i)) {
        if (c.startsWith(".")) continue;
        const l = `${i}/${c}`;
        if (c.startsWith("@") && !o) {
          r(l, c);
          continue;
        }
        const a = o ? `${o}/${c}` : c;
        try {
          const u = e.readFileSync(`${l}/package.json`, "utf8"), f = JSON.parse(u);
          s.push({
            name: a,
            version: f.version || "0.0.0",
            dir: l
          });
        } catch {
        }
      }
    } catch {
    }
  };
  return r(n), s;
}
async function nt(e, t) {
  const n = G(e, t.cwd), s = [];
  for (const i of n) try {
    const o = e.readFileSync(`${i.dir}/package.json`, "utf8"), c = JSON.parse(o).funding;
    if (!c) continue;
    const l = [], a = (u) => {
      u && (typeof u == "string" ? l.push(u) : Array.isArray(u) ? u.forEach(a) : typeof u == "object" && u.url && l.push(String(u.url)));
    };
    a(c);
    for (const u of l) s.push({
      name: i.name,
      version: i.version,
      url: u
    });
  } catch {
  }
  if (s.length === 0) return g(`0 packages are looking for funding
`);
  let r = `${s.length} package(s) looking for funding
`;
  for (const i of s) r += `${i.name}@${i.version}
  ${i.url}
`;
  return g(r);
}
async function st(e, t) {
  const n = D(e, t.cwd, t.env), s = new q({ endpoint: n }), r = `${t.cwd}/package.json`;
  let i = {};
  try {
    if (e.existsSync(r)) {
      const a = JSON.parse(e.readFileSync(r, "utf8"));
      i = {
        ...a.dependencies || {},
        ...a.devDependencies || {},
        ...a.optionalDependencies || {}
      };
    }
  } catch {
  }
  G(e, t.cwd).filter((a) => !a.name.includes("/") || a.name.startsWith("@") ? i[a.name] !== void 0 || (() => {
    const u = `${t.cwd}/node_modules`;
    return a.dir.startsWith(u + "/") && a.dir.slice(u.length + 1).split("/").length <= (a.name.startsWith("@") ? 2 : 1);
  })() : !1);
  const o = Object.keys(i), c = [];
  for (const a of o) {
    const u = i[a];
    let f = "";
    try {
      const p = `${t.cwd}/node_modules/${a}`;
      e.existsSync(`${p}/package.json`) && (f = JSON.parse(e.readFileSync(`${p}/package.json`, "utf8")).version);
    } catch {
    }
    if (f)
      try {
        const p = await s.fetchManifest(a), h = Object.keys(p.versions), m = he(h, u) || f, d = p["dist-tags"]?.latest || m;
        (w(f, d) < 0 || w(f, m) < 0) && c.push({
          name: a,
          current: f,
          wanted: m,
          latest: d
        });
      } catch {
      }
  }
  if (c.length === 0) return g("");
  let l = `Package  Current  Wanted  Latest
`;
  for (const a of c) l += `${a.name}  ${a.current}  ${a.wanted}  ${a.latest}
`;
  return g(l, 1);
}
async function rt(e, t) {
  const n = D(e, t.cwd, t.env), s = G(e, t.cwd);
  if (s.length === 0) return g(`found 0 vulnerabilities
`);
  const r = {};
  for (const i of s)
    r[i.name] || (r[i.name] = []), r[i.name].includes(i.version) || r[i.name].push(i.version);
  try {
    const i = await J(`${n}/-/npm/v1/security/advisories/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(r)
    });
    if (!i.ok) return y(`npm audit: registry returned HTTP ${i.status}
`);
    const o = await i.json();
    let c = 0, l = "";
    for (const [a, u] of Object.entries(o || {})) for (const f of u || [])
      c++, l += `${f.severity || "info"}  ${a}: ${f.title || "advisory"}${f.url ? ` (${f.url})` : ""}
`;
    return l += `found ${c} vulnerabilit${c === 1 ? "y" : "ies"}
`, {
      stdout: l,
      stderr: "",
      exitCode: c > 0 ? 1 : 0
    };
  } catch (i) {
    return y(`npm audit: ${i?.message || "network error"}
`);
  }
}
function Te(e, t) {
  if (e.startsWith("node_modules/") || e === "node_modules" || e.startsWith(".git/") || e === ".git") return !0;
  for (const n of t)
    if (!(!n || n.startsWith("#"))) {
      if (n.endsWith("/")) {
        if (e === n.slice(0, -1) || e.startsWith(n)) return !0;
      } else if (n.includes("*")) {
        const s = new RegExp("^" + n.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
        if (s.test(e) || s.test(e.split("/").pop() || "")) return !0;
      } else if (e === n || e.endsWith("/" + n)) return !0;
    }
  return !1;
}
function it(e, t) {
  const n = `${t.cwd}/package.json`;
  if (!e.existsSync(n)) return y(`npm pack: no package.json found
`);
  let s;
  try {
    s = JSON.parse(e.readFileSync(n, "utf8"));
  } catch (d) {
    return y(`npm pack: ${d?.message || "invalid package.json"}
`);
  }
  const r = (s.name || "package").replace(/^@/, "").replace(/\//g, "-"), i = s.version || "0.0.0", o = `${r}-${i}.tgz`;
  let c = [];
  try {
    e.existsSync(`${t.cwd}/.npmignore`) && (c = e.readFileSync(`${t.cwd}/.npmignore`, "utf8").split(`
`).map((d) => d.trim()));
  } catch {
  }
  const l = Array.isArray(s.files) ? s.files : null, a = [], u = (d, $) => {
    for (const b of e.readdirSync(d)) {
      if (b === "node_modules" || b === ".git") continue;
      const _ = `${d}/${b}`, k = ($ ? `${$}/` : "") + b;
      if (e.statSync(_).isDirectory()) u(_, k);
      else {
        if (Te(k, c) || l && !(k === "package.json" || k === "README.md" || k === "LICENSE" || k === "license" || l.some((W) => k === W || k.startsWith(W.replace(/\/$/, "") + "/") || k === W.replace(/\/$/, ""))))
          continue;
        const S = e.readFileSync(_), oe = typeof S == "string" ? new TextEncoder().encode(S) : S instanceof Uint8Array ? S : new TextEncoder().encode(String(S));
        a.push({
          path: `package/${k}`,
          content: oe
        });
      }
    }
  };
  u(t.cwd, "");
  const f = _e(a), p = `${t.cwd}/${o}`.replace(/\/+/g, "/");
  e.writeFileSync(p, f);
  const h = "npm notice";
  let m = `${h}
`;
  m += `${h} package: ${s.name}@${i}
`;
  for (const d of a) m += `${h} ${d.path}
`;
  return m += `${h} total files: ${a.length}
`, m += `${o}
`, g(m);
}
function ot(e, t) {
  const n = `${t}/package-lock.json`;
  if (!e.existsSync(n)) return null;
  try {
    const s = JSON.parse(e.readFileSync(n, "utf8")), r = [];
    if (s.packages && typeof s.packages == "object") for (const [i, o] of Object.entries(s.packages)) {
      if (!i || i === "" || !o || !o.version) continue;
      const c = o.name || (i.startsWith("node_modules/") ? i.replace(/^node_modules\//, "").replace(/\/node_modules\//g, "/") : i);
      i.includes("/node_modules/") && `${c}`, i.startsWith("node_modules/") && (i.slice(13).split("/node_modules/").length > 1 || r.push({
        name: c,
        version: o.version,
        resolved: o.resolved,
        integrity: o.integrity
      }));
    }
    else if (s.dependencies && typeof s.dependencies == "object") for (const [i, o] of Object.entries(s.dependencies)) r.push({
      name: i,
      version: o.version,
      resolved: o.resolved,
      integrity: o.integrity
    });
    return {
      packages: r,
      lockfileVersion: s.lockfileVersion || 1
    };
  } catch {
    return null;
  }
}
function ct(e, t, n) {
  const s = `${t}/package.json`;
  if (!e.existsSync(s)) return {
    ok: !1,
    reason: "Missing package.json"
  };
  let r;
  try {
    r = JSON.parse(e.readFileSync(s, "utf8"));
  } catch {
    return {
      ok: !1,
      reason: "Invalid package.json"
    };
  }
  const i = {
    ...r.dependencies || {},
    ...r.devDependencies || {},
    ...r.optionalDependencies || {}
  }, o = new Map(n.map((c) => [c.name, c.version]));
  for (const [c, l] of Object.entries(i)) {
    const a = o.get(c);
    if (!a) return {
      ok: !1,
      reason: `package-lock.json missing entry for "${c}"`
    };
    if (!O(a, l) && l !== a && l !== `=${a}` && !l.startsWith("npm:") && w(a, l.replace(/^[\^=~]/, "")) < 0 && !O(a, l))
      return {
        ok: !1,
        reason: `package.json "${c}"@${l} does not match lock ${a}`
      };
  }
  return { ok: !0 };
}
function at(e, t, n, s) {
  const r = { "": {
    name: s?.name || "",
    version: s?.version || "0.0.0",
    dependencies: Object.fromEntries([...n.entries()].map(([o, c]) => [o, c.version]))
  } };
  for (const [o, c] of n) r[`node_modules/${o}`] = {
    version: c.version,
    resolved: c.tarballUrl,
    dependencies: c.dependencies || {}
  };
  const i = {
    name: s?.name || "",
    version: s?.version || "0.0.0",
    lockfileVersion: 3,
    requires: !0,
    packages: r
  };
  e.writeFileSync(`${t}/package-lock.json`, JSON.stringify(i, null, 2) + `
`);
}
export {
  Ie as C,
  Be as E,
  Ue as S,
  qe as T,
  ot as _,
  ze as a,
  He as b,
  rt as c,
  st as d,
  it as f,
  ct as g,
  tt as h,
  Ze as i,
  Ye as l,
  Qe as m,
  P as n,
  Ve as o,
  et as p,
  se as r,
  Xe as s,
  C as t,
  nt as u,
  D as v,
  Ge as w,
  at as x,
  Ke as y
};

//# sourceMappingURL=pm-cli-DuCx87WQ.js.map