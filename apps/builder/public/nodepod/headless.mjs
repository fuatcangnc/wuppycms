import { r as U } from "./fast-pako-BwXotfTx.js";
import { A as ue, D as ge, E as Be, N as ce, O as Fe, P as he, T as Ae, cn as Ce, d as Xe, dn as ye, f as pe, fn as k, j as Pe, k as Le, ln as le, mn as T, n as xe, pn as V, r as Ee, t as Ge, un as me, w as Ze } from "./nodepod-Y98NXDvC.js";
import { d as ve, m as N, p as Oe } from "./offload-BQq4ymyv.js";
import { createHash as b } from "node:crypto";
import { existsSync as y, readFileSync as x } from "node:fs";
import { dirname as R, join as u } from "node:path";
import { fileURLToPath as E } from "node:url";
import { Worker as S } from "node:worker_threads";
import q from "node:http";
import { mkdir as D, open as G, readFile as X, readdir as m, rename as K, rm as _, unlink as B, writeFile as v } from "node:fs/promises";
import { tmpdir as $ } from "node:os";
function ee() {
  return `"use strict";
const { parentPort, workerData } = require("node:worker_threads");
if (!parentPort) throw new Error("nodepod worker shim: missing parentPort");

const messageListeners = new Set();
const errorListeners = new Set();

function emitMessage(data) {
  const ev = { data };
  for (const fn of messageListeners) {
    try { fn(ev); } catch (err) { console.error(err); }
  }
  if (typeof globalThis.onmessage === "function") {
    try { globalThis.onmessage(ev); } catch (err) { console.error(err); }
  }
}

globalThis.self = globalThis;
globalThis.postMessage = function postMessage(data, transfer) {
  if (Array.isArray(transfer) && transfer.length) {
    parentPort.postMessage(data, transfer);
  } else {
    parentPort.postMessage(data);
  }
};
globalThis.addEventListener = function addEventListener(type, fn) {
  if (type === "message") messageListeners.add(fn);
  else if (type === "error") errorListeners.add(fn);
};
globalThis.removeEventListener = function removeEventListener(type, fn) {
  if (type === "message") messageListeners.delete(fn);
  else if (type === "error") errorListeners.delete(fn);
};
globalThis.onmessage = null;
globalThis.onerror = null;

parentPort.on("message", function (data) { emitMessage(data); });
parentPort.on("error", function (err) {
  const ev = { message: err && err.message ? err.message : String(err), error: err };
  for (const fn of errorListeners) {
    try { fn(ev); } catch (_) { /* ignore */ }
  }
  if (typeof globalThis.onerror === "function") {
    try { globalThis.onerror(ev); } catch (_) { /* ignore */ }
  }
});

const source = workerData && workerData.__nodepodSource;
if (typeof source !== "string" || !source) {
  throw new Error("nodepod worker shim: missing __nodepodSource");
}
(0, eval)(source);
`;
}
function re(r) {
  const d = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
  let f = null, s = null;
  return r.on("message", (t) => {
    const e = { data: t };
    for (const o of d) try {
      o(e);
    } catch {
    }
    if (f) try {
      f(e);
    } catch {
    }
  }), r.on("error", (t) => {
    const e = {
      message: t.message,
      error: t
    };
    for (const o of i) try {
      o(e);
    } catch {
    }
    if (s) try {
      s(e);
    } catch {
    }
  }), {
    postMessage(t, e) {
      e && e.length ? r.postMessage(t, e) : r.postMessage(t);
    },
    terminate() {
      r.terminate();
    },
    addEventListener(t, e) {
      t === "message" ? d.add(e) : t === "error" && i.add(e);
    },
    removeEventListener(t, e) {
      t === "message" ? d.delete(e) : t === "error" && i.delete(e);
    },
    get onmessage() {
      return f;
    },
    set onmessage(t) {
      f = t;
    },
    get onerror() {
      return s;
    },
    set onerror(t) {
      s = t;
    }
  };
}
function P(r, d) {
  return re(new S(ee(), {
    eval: !0,
    workerData: { __nodepodSource: r },
    ...d ? { name: d } : {}
  }));
}
function te(r) {
  const d = r.host ?? "127.0.0.1", i = r.port ?? 0;
  let f = null, s = null;
  async function t(a) {
    const n = [];
    for await (const w of a) n.push(Buffer.isBuffer(w) ? w : Buffer.from(w));
    return Buffer.concat(n);
  }
  function e(a) {
    const n = {};
    for (const [w, g] of Object.entries(a))
      g != null && (n[w] = Array.isArray(g) ? g.join(", ") : g);
    return n;
  }
  async function o(a, n) {
    try {
      const w = new URL(a.url || "/", `http://${d}`), g = w.pathname.split("/").filter(Boolean);
      if (g[0] !== "__virtual__" || g.length < 3) {
        n.statusCode = 404, n.setHeader("Content-Type", "text/plain"), n.end("Not Found");
        return;
      }
      const c = g[1], h = Number(g[2]);
      if (!Number.isFinite(h)) {
        n.statusCode = 400, n.setHeader("Content-Type", "text/plain"), n.end("Invalid port");
        return;
      }
      const A = await t(a), M = A.byteLength > 0 ? A.buffer.slice(A.byteOffset, A.byteOffset + A.byteLength) : void 0, Z = g.slice(3), Q = (Z.length ? `/${Z.join("/")}` : "/") + w.search, F = await r.proxy.handleRequest(c, h, (a.method || "GET").toUpperCase(), Q, e(a.headers), M);
      n.statusCode = F.statusCode;
      for (const [j, p] of Object.entries(F.headers))
        p != null && (Array.isArray(p), n.setHeader(j, p));
      const J = F.body ? Buffer.isBuffer(F.body) ? F.body : Buffer.from(F.body) : Buffer.alloc(0);
      n.end(J);
    } catch (w) {
      n.statusCode = 500, n.setHeader("Content-Type", "text/plain"), n.end(w instanceof Error ? w.message : String(w));
    }
  }
  return {
    kind: "local-http",
    get baseUrl() {
      return s;
    },
    async start() {
      if (f) return;
      f = q.createServer((n, w) => {
        o(n, w);
      }), await new Promise((n, w) => {
        f.once("error", w), f.listen(i, d, () => {
          f.off("error", w), n();
        });
      });
      const a = f.address();
      a && typeof a == "object" ? s = `http://${d}:${a.port}` : s = `http://${d}`, r.proxy.setBaseUrl(s);
    },
    async stop() {
      const a = f;
      f = null, s = null, a && await new Promise((n) => {
        a.close(() => n()), a.closeIdleConnections?.(), a.closeAllConnections?.();
      });
    }
  };
}
var L = 2, O = 6048e5;
function W() {
  return process.env.NODEPOD_CACHE || u($(), "nodepod-snapshots");
}
function se(r, d) {
  const i = b("sha256").update(d).digest("hex");
  return u(r, `${i}.bin`);
}
async function oe(r = W()) {
  try {
    await D(r, { recursive: !0 });
  } catch {
    return null;
  }
  const d = (t) => se(r, t).replace(/\.bin$/, ""), i = (t, e) => e.dataFile ?? `${d(t).slice(r.length + 1)}.bin`, f = async (t) => {
    try {
      const e = JSON.parse(await X(`${d(t)}.meta.json`, "utf8"));
      return e.schema !== L || e.createdAt != null && Date.now() - e.createdAt > O ? null : e;
    } catch {
      return null;
    }
  };
  (async () => {
    try {
      const t = await m(r), e = Date.now(), o = /* @__PURE__ */ new Set();
      for (const a of t) {
        if (!a.endsWith(".meta.json")) continue;
        const n = a.slice(0, -10);
        try {
          const w = JSON.parse(await X(u(r, a), "utf8")), g = w.dataFile ?? `${n}.bin`;
          w.schema !== L || w.createdAt != null && e - w.createdAt > O ? (await B(u(r, a)).catch(() => {
          }), await B(u(r, g)).catch(() => {
          })) : o.add(g);
        } catch {
        }
      }
      for (const a of t) a.endsWith(".bin") && !o.has(a) && await B(u(r, a)).catch(() => {
      });
    } catch {
    }
  })();
  const s = /* @__PURE__ */ new Map();
  return {
    async getManifest(t) {
      const e = await f(t);
      if (!e) return null;
      const o = i(t, e);
      let a;
      try {
        a = await G(u(r, o), "r");
        const n = Buffer.alloc(4);
        if ((await a.read(n, 0, 4, 0)).bytesRead < 4) return null;
        const w = n.readUInt32LE(0), g = Buffer.alloc(w);
        return (await a.read(g, 0, w, 4)).bytesRead < w ? null : (s.set(o, 4 + w), {
          manifest: JSON.parse(g.toString("utf8")),
          version: o
        });
      } catch {
        return null;
      } finally {
        await a?.close();
      }
    },
    async readRange(t, e, o, a) {
      let n;
      try {
        n = await G(u(r, e), "r");
        let w = s.get(e);
        if (w === void 0) {
          const h = Buffer.alloc(4);
          await n.read(h, 0, 4, 0), w = 4 + h.readUInt32LE(0), s.set(e, w);
        }
        const g = new Uint8Array(a), { bytesRead: c } = await n.read(g, 0, a, w + o);
        return c === a ? g : null;
      } catch {
        return null;
      } finally {
        await n?.close();
      }
    },
    async get(t) {
      try {
        const e = await f(t);
        if (!e) return null;
        const o = await X(u(r, i(t, e)));
        if (o.byteLength < 4) return null;
        const a = o.readUInt32LE(0), n = o.subarray(4, 4 + a), w = o.buffer.slice(o.byteOffset + 4 + a, o.byteOffset + o.byteLength);
        return {
          manifest: JSON.parse(n.toString("utf8")),
          data: w
        };
      } catch {
        return null;
      }
    },
    async set(t, e) {
      const o = d(t), a = await f(t), n = `${o.slice(r.length + 1)}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.bin`, w = Buffer.from(JSON.stringify(e.manifest), "utf8"), g = Buffer.from(e.data), c = Buffer.alloc(4);
      c.writeUInt32LE(w.byteLength, 0), await v(u(r, n), Buffer.concat([
        c,
        w,
        g
      ])), await v(`${o}.meta.json`, JSON.stringify({
        schema: L,
        createdAt: Date.now(),
        dataFile: n
      })), a && await B(u(r, i(t, a))).catch(() => {
      });
    },
    close() {
    }
  };
}
var I = "manifest.json", C = "blobs";
function l(r, d) {
  return u(r, C, encodeURIComponent(d));
}
async function H(r, d) {
  const i = `${r}.${process.pid}.${Date.now()}.tmp`, f = await G(i, "w");
  try {
    await f.writeFile(d), await f.sync();
  } finally {
    await f.close();
  }
  await K(i, r);
}
async function Y(r) {
  try {
    for (const d of await m(r)) d.endsWith(".tmp") && await B(u(r, d)).catch(() => {
    });
  } catch {
  }
}
function ae(r) {
  let d = null, i = !1;
  const f = async () => {
    if (d) return d;
    let s;
    try {
      s = await X(u(r, I), "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      return d = /* @__PURE__ */ new Map(), i = !1, d;
    }
    let t;
    try {
      t = JSON.parse(s);
    } catch {
      const e = /* @__PURE__ */ new Error(`[Nodepod] saved workspace at ${r} is corrupt (manifest.json is not valid JSON); delete the directory to start over`);
      throw e.code = "EWORKSPACECORRUPT", e;
    }
    return d = new Map(t.entries.map((e) => [e.path, e])), i = !0, d;
  };
  return {
    async load() {
      d = null;
      const s = await f();
      return await Y(r), await Y(u(r, C)), i ? {
        version: 1,
        entries: Array.from(s.values(), (t) => ({ ...t }))
      } : null;
    },
    async readBlobs(s) {
      const t = /* @__PURE__ */ new Map();
      return await Promise.all(s.map(async (e) => {
        try {
          const o = await X(l(r, e));
          t.set(e, new Uint8Array(o.buffer, o.byteOffset, o.byteLength));
        } catch {
        }
      })), t;
    },
    async commit(s) {
      const t = await f();
      await D(u(r, C), { recursive: !0 });
      for (const { id: o, data: a } of s.putBlobs) await H(l(r, o), a);
      const e = new Map(t);
      for (const o of s.deletePrefixes) for (const a of Array.from(e.keys())) V(a, o) && e.delete(a);
      for (const o of s.deletePaths) e.delete(o);
      for (const o of s.putEntries) e.set(o.path, { ...o });
      if (k(s)) {
        const o = {
          version: 1,
          entries: Array.from(e.values())
        };
        await H(u(r, I), JSON.stringify(o)), d = e, i = !0;
      }
      for (const o of s.deleteBlobs) await B(l(r, o)).catch(() => {
      });
    },
    async sweep() {
      const s = await f(), t = /* @__PURE__ */ new Set();
      for (const o of s.values()) o.blob && t.add(encodeURIComponent(o.blob));
      let e;
      try {
        e = await m(u(r, C));
      } catch {
        return;
      }
      for (const o of e) !o.endsWith(".tmp") && !t.has(o) && await B(u(r, C, o)).catch(() => {
      });
    },
    async clear() {
      await _(r, {
        recursive: !0,
        force: !0
      }), d = /* @__PURE__ */ new Map(), i = !1;
    }
  };
}
function z() {
  try {
    const r = R(E(import.meta.url)), d = [
      u(r, "..", "..", "__worker__.js"),
      u(r, "..", "..", "..", "dist", "__worker__.js"),
      u(process.cwd(), "dist", "__worker__.js")
    ];
    for (const i of d) if (y(i)) return i;
  } catch {
  }
  return null;
}
function de() {
  const r = Buffer.from(T, "base64");
  return U(r, { to: "string" });
}
function ne(r, d) {
  return !d && r && y(r) ? x(r, "utf8") : r && y(r) ? x(r, "utf8") : de();
}
function we(r = {}) {
  let d = r.workerPath ?? z(), i = null;
  function f(s) {
    if (!s && i) return i;
    const t = ne(d, !!s);
    return s || (i = t), t;
  }
  return {
    kind: "node",
    defaultHeadless: !0,
    canCreateWorkers() {
      return !0;
    },
    createWorker(s) {
      if (s.type === "url") {
        let o = s.url;
        if (o.startsWith("file:") && (o = E(o)), !y(o)) throw new Error(`[Nodepod] Node host cannot load worker URL: ${s.url}`);
        const a = x(o, "utf8"), n = P(a, s.name);
        return n.__nodepodDirect = !0, n;
      }
      if (s.type === "source") return P(s.source, s.name);
      const t = f(s.embedded), e = P(t, s.name);
      return d && !s.embedded && (e.__nodepodDirect = !0), e;
    },
    async probeProcessWorkerUrl(s) {
      if (s) {
        let e = s;
        return e.startsWith("file:") && (e = E(e)), y(e) ? (d = e, i = null, e) : null;
      }
      const t = r.workerPath ?? z();
      return t ? (d = t, i = null, t) : null;
    },
    disposeGlobalResources() {
      i = null;
    },
    async openSnapshotCache(s) {
      return s.enableSnapshotCache === !1 || s.packageStore === "memory" ? null : oe(r.cacheDir);
    },
    async openWorkspaceStore(s) {
      const t = b("sha256").update(s).digest("hex").slice(0, 32);
      return ae(u(r.cacheDir ?? W(), "workspaces", t));
    },
    createHttpIngress({ proxy: s, headless: t }) {
      return t ? te({
        proxy: s,
        host: r.httpHost,
        port: r.httpPort
      }) : {
        kind: "programmatic",
        baseUrl: null
      };
    }
  };
}
N(we());
export {
  ue as DependencyInstaller,
  Ce as MemoryVolume,
  Ge as Nodepod,
  Ae as NodepodFS,
  Xe as NodepodFSClient,
  pe as NodepodFSClientError,
  Ze as NodepodProcess,
  Le as NodepodSWSetupError,
  Be as RequestProxy,
  Ee as WorkspacePersistence,
  ae as createFsWorkspaceStore,
  le as createIndexedDBWorkspaceStore,
  te as createLocalHttpIngress,
  xe as createMemoryWorkspaceStore,
  we as createNodeHost,
  me as deleteIndexedDBWorkspace,
  ce as discoverWorkspaces,
  ge as getProxyInstance,
  ve as getRuntimeHost,
  Pe as install,
  ye as listIndexedDBWorkspaces,
  oe as openFsSnapshotCache,
  he as readWorkspacePatterns,
  Fe as resetProxy,
  Oe as resetRuntimeHost,
  N as setRuntimeHost
};

//# sourceMappingURL=headless.mjs.map