import { r as h } from "./fast-pako-BwXotfTx.js";
import { A as oe, D as Be, E as we, N as Le, O as ge, P as Ce, T as ie, cn as xe, d as je, dn as Fe, f as be, fn as R, j as Qe, k as He, ln as Xe, mn as N, n as ye, pn as T, r as ve, t as Ee, un as le, w as Pe } from "./nodepod-x22a8Pmu.js";
import { d as Ie, m as k, p as De } from "./offload-DgyAYqvz.js";
import { createHash as m } from "node:crypto";
import { existsSync as F, readFileSync as y } from "node:fs";
import { dirname as q, join as o } from "node:path";
import { fileURLToPath as v } from "node:url";
import { Worker as S } from "node:worker_threads";
import J from "node:http";
import { mkdir as z, open as E, readFile as j, readdir as l, rename as V, rm as _, unlink as w, writeFile as I } from "node:fs/promises";
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
function te(t) {
  const f = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
  let d = null, n = null;
  return t.on("message", (s) => {
    const e = { data: s };
    for (const r of f) try {
      r(e);
    } catch {
    }
    if (d) try {
      d(e);
    } catch {
    }
  }), t.on("error", (s) => {
    const e = {
      message: s.message,
      error: s
    };
    for (const r of a) try {
      r(e);
    } catch {
    }
    if (n) try {
      n(e);
    } catch {
    }
  }), {
    postMessage(s, e) {
      e && e.length ? t.postMessage(s, e) : t.postMessage(s);
    },
    terminate() {
      t.terminate();
    },
    addEventListener(s, e) {
      s === "message" ? f.add(e) : s === "error" && a.add(e);
    },
    removeEventListener(s, e) {
      s === "message" ? f.delete(e) : s === "error" && a.delete(e);
    },
    get onmessage() {
      return d;
    },
    set onmessage(s) {
      d = s;
    },
    get onerror() {
      return n;
    },
    set onerror(s) {
      n = s;
    }
  };
}
function Q(t, f) {
  return te(new S(ee(), {
    eval: !0,
    workerData: { __nodepodSource: t },
    ...f ? { name: f } : {}
  }));
}
function se(t) {
  const f = t.host ?? "127.0.0.1", a = t.port ?? 0;
  let d = null, n = null;
  async function s(c) {
    const u = [];
    for await (const A of c) u.push(Buffer.isBuffer(A) ? A : Buffer.from(A));
    return Buffer.concat(u);
  }
  function e(c) {
    const u = {};
    for (const [A, B] of Object.entries(c))
      B != null && (u[A] = Array.isArray(B) ? B.join(", ") : B);
    return u;
  }
  async function r(c, u) {
    try {
      const A = new URL(c.url || "/", `http://${f}`), B = A.pathname.split("/").filter(Boolean);
      if (B[0] !== "__virtual__" || B.length < 3) {
        u.statusCode = 404, u.setHeader("Content-Type", "text/plain"), u.end("Not Found");
        return;
      }
      const L = B[1], C = Number(B[2]);
      if (!Number.isFinite(C)) {
        u.statusCode = 400, u.setHeader("Content-Type", "text/plain"), u.end("Invalid port");
        return;
      }
      const i = await s(c), K = i.byteLength > 0 ? i.buffer.slice(i.byteOffset, i.byteOffset + i.byteLength) : void 0, P = B.slice(3), p = (P.length ? `/${P.join("/")}` : "/") + A.search, g = await t.proxy.handleRequest(L, C, (c.method || "GET").toUpperCase(), p, e(c.headers), K);
      u.statusCode = g.statusCode;
      for (const [O, b] of Object.entries(g.headers))
        b != null && (Array.isArray(b), u.setHeader(O, b));
      const Z = g.body ? Buffer.isBuffer(g.body) ? g.body : Buffer.from(g.body) : Buffer.alloc(0);
      u.end(Z);
    } catch (A) {
      u.statusCode = 500, u.setHeader("Content-Type", "text/plain"), u.end(A instanceof Error ? A.message : String(A));
    }
  }
  return {
    kind: "local-http",
    get baseUrl() {
      return n;
    },
    async start() {
      if (d) return;
      d = J.createServer((u, A) => {
        r(u, A);
      }), await new Promise((u, A) => {
        d.once("error", A), d.listen(a, f, () => {
          d.off("error", A), u();
        });
      });
      const c = d.address();
      c && typeof c == "object" ? n = `http://${f}:${c.port}` : n = `http://${f}`, t.proxy.setBaseUrl(n);
    },
    async stop() {
      const c = d;
      d = null, n = null, c && await new Promise((u) => {
        c.close(() => u()), c.closeIdleConnections?.(), c.closeAllConnections?.();
      });
    }
  };
}
var H = 2, D = 6048e5;
function G() {
  return process.env.NODEPOD_CACHE || o($(), "nodepod-snapshots");
}
function ne(t, f) {
  const a = m("sha256").update(f).digest("hex");
  return o(t, `${a}.bin`);
}
async function re(t = G()) {
  try {
    await z(t, { recursive: !0 });
  } catch {
    return null;
  }
  const f = (s) => ne(t, s).replace(/\.bin$/, ""), a = (s, e) => e.dataFile ?? `${f(s).slice(t.length + 1)}.bin`, d = async (s) => {
    try {
      const e = JSON.parse(await j(`${f(s)}.meta.json`, "utf8"));
      return e.schema !== H || e.createdAt != null && Date.now() - e.createdAt > D ? null : e;
    } catch {
      return null;
    }
  };
  (async () => {
    try {
      const s = await l(t), e = Date.now(), r = /* @__PURE__ */ new Set();
      for (const c of s) {
        if (!c.endsWith(".meta.json")) continue;
        const u = c.slice(0, -10);
        try {
          const A = JSON.parse(await j(o(t, c), "utf8")), B = A.dataFile ?? `${u}.bin`;
          A.schema !== H || A.createdAt != null && e - A.createdAt > D ? (await w(o(t, c)).catch(() => {
          }), await w(o(t, B)).catch(() => {
          })) : r.add(B);
        } catch {
        }
      }
      for (const c of s) c.endsWith(".bin") && !r.has(c) && await w(o(t, c)).catch(() => {
      });
    } catch {
    }
  })();
  const n = /* @__PURE__ */ new Map();
  return {
    async getManifest(s) {
      const e = await d(s);
      if (!e) return null;
      const r = a(s, e);
      let c;
      try {
        c = await E(o(t, r), "r");
        const u = Buffer.alloc(4);
        if ((await c.read(u, 0, 4, 0)).bytesRead < 4) return null;
        const A = u.readUInt32LE(0), B = Buffer.alloc(A);
        return (await c.read(B, 0, A, 4)).bytesRead < A ? null : (n.set(r, 4 + A), {
          manifest: JSON.parse(B.toString("utf8")),
          version: r
        });
      } catch {
        return null;
      } finally {
        await c?.close();
      }
    },
    async readRange(s, e, r, c) {
      let u;
      try {
        u = await E(o(t, e), "r");
        let A = n.get(e);
        if (A === void 0) {
          const C = Buffer.alloc(4);
          await u.read(C, 0, 4, 0), A = 4 + C.readUInt32LE(0), n.set(e, A);
        }
        const B = new Uint8Array(c), { bytesRead: L } = await u.read(B, 0, c, A + r);
        return L === c ? B : null;
      } catch {
        return null;
      } finally {
        await u?.close();
      }
    },
    async get(s) {
      try {
        const e = await d(s);
        if (!e) return null;
        const r = await j(o(t, a(s, e)));
        if (r.byteLength < 4) return null;
        const c = r.readUInt32LE(0), u = r.subarray(4, 4 + c), A = r.buffer.slice(r.byteOffset + 4 + c, r.byteOffset + r.byteLength);
        return {
          manifest: JSON.parse(u.toString("utf8")),
          data: A
        };
      } catch {
        return null;
      }
    },
    async set(s, e) {
      const r = f(s), c = await d(s), u = `${r.slice(t.length + 1)}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.bin`, A = Buffer.from(JSON.stringify(e.manifest), "utf8"), B = Buffer.from(e.data), L = Buffer.alloc(4);
      L.writeUInt32LE(A.byteLength, 0), await I(o(t, u), Buffer.concat([
        L,
        A,
        B
      ])), await I(`${r}.meta.json`, JSON.stringify({
        schema: H,
        createdAt: Date.now(),
        dataFile: u
      })), c && await w(o(t, a(s, c))).catch(() => {
      });
    },
    close() {
    }
  };
}
var Y = "manifest.json", x = "blobs";
function X(t, f) {
  return o(t, x, encodeURIComponent(f));
}
async function M(t, f) {
  const a = `${t}.${process.pid}.${Date.now()}.tmp`, d = await E(a, "w");
  try {
    await d.writeFile(f), await d.sync();
  } finally {
    await d.close();
  }
  await V(a, t);
}
async function U(t) {
  try {
    for (const f of await l(t)) f.endsWith(".tmp") && await w(o(t, f)).catch(() => {
    });
  } catch {
  }
}
function ce(t) {
  let f = null, a = !1;
  const d = async () => {
    if (f) return f;
    let n;
    try {
      n = await j(o(t, Y), "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      return f = /* @__PURE__ */ new Map(), a = !1, f;
    }
    let s;
    try {
      s = JSON.parse(n);
    } catch {
      const e = /* @__PURE__ */ new Error(`[Nodepod] saved workspace at ${t} is corrupt (manifest.json is not valid JSON); delete the directory to start over`);
      throw e.code = "EWORKSPACECORRUPT", e;
    }
    return f = new Map(s.entries.map((e) => [e.path, e])), a = !0, f;
  };
  return {
    async load() {
      f = null;
      const n = await d();
      return await U(t), await U(o(t, x)), a ? {
        version: 1,
        entries: Array.from(n.values(), (s) => ({ ...s }))
      } : null;
    },
    async readBlobs(n) {
      const s = /* @__PURE__ */ new Map();
      return await Promise.all(n.map(async (e) => {
        try {
          const r = await j(X(t, e));
          s.set(e, new Uint8Array(r.buffer, r.byteOffset, r.byteLength));
        } catch {
        }
      })), s;
    },
    async commit(n) {
      const s = await d();
      await z(o(t, x), { recursive: !0 });
      for (const { id: r, data: c } of n.putBlobs) await M(X(t, r), c);
      const e = new Map(s);
      for (const r of n.deletePrefixes) for (const c of Array.from(e.keys())) T(c, r) && e.delete(c);
      for (const r of n.deletePaths) e.delete(r);
      for (const r of n.putEntries) e.set(r.path, { ...r });
      if (R(n)) {
        const r = {
          version: 1,
          entries: Array.from(e.values())
        };
        await M(o(t, Y), JSON.stringify(r)), f = e, a = !0;
      }
      for (const r of n.deleteBlobs) await w(X(t, r)).catch(() => {
      });
    },
    async sweep() {
      const n = await d(), s = /* @__PURE__ */ new Set();
      for (const r of n.values()) r.blob && s.add(encodeURIComponent(r.blob));
      let e;
      try {
        e = await l(o(t, x));
      } catch {
        return;
      }
      for (const r of e) !r.endsWith(".tmp") && !s.has(r) && await w(o(t, x, r)).catch(() => {
      });
    },
    async clear() {
      await _(t, {
        recursive: !0,
        force: !0
      }), f = /* @__PURE__ */ new Map(), a = !1;
    }
  };
}
function W() {
  try {
    const t = q(v(import.meta.url)), f = [
      o(t, "..", "..", "__worker__.js"),
      o(t, "..", "..", "..", "dist", "__worker__.js"),
      o(process.cwd(), "dist", "__worker__.js")
    ];
    for (const a of f) if (F(a)) return a;
  } catch {
  }
  return null;
}
function fe() {
  const t = Buffer.from(N, "base64");
  return h(t, { to: "string" });
}
function ue(t, f) {
  return !f && t && F(t) ? y(t, "utf8") : t && F(t) ? y(t, "utf8") : fe();
}
function Ae(t = {}) {
  let f = t.workerPath ?? W(), a = null;
  function d(n) {
    if (!n && a) return a;
    const s = ue(f, !!n);
    return n || (a = s), s;
  }
  return {
    kind: "node",
    defaultHeadless: !0,
    canCreateWorkers() {
      return !0;
    },
    createWorker(n) {
      if (n.type === "url") {
        let r = n.url;
        if (r.startsWith("file:") && (r = v(r)), !F(r)) throw new Error(`[Nodepod] Node host cannot load worker URL: ${n.url}`);
        const c = y(r, "utf8"), u = Q(c, n.name);
        return u.__nodepodDirect = !0, u;
      }
      if (n.type === "source") return Q(n.source, n.name);
      const s = d(n.embedded), e = Q(s, n.name);
      return f && !n.embedded && (e.__nodepodDirect = !0), e;
    },
    async probeProcessWorkerUrl(n) {
      if (n) {
        let e = n;
        return e.startsWith("file:") && (e = v(e)), F(e) ? (f = e, a = null, e) : null;
      }
      const s = t.workerPath ?? W();
      return s ? (f = s, a = null, s) : null;
    },
    disposeGlobalResources() {
      a = null;
    },
    async openSnapshotCache(n) {
      return n.enableSnapshotCache === !1 || n.packageStore === "memory" ? null : re(t.cacheDir);
    },
    async openWorkspaceStore(n) {
      const s = m("sha256").update(n).digest("hex").slice(0, 32);
      return ce(o(t.cacheDir ?? G(), "workspaces", s));
    },
    createHttpIngress({ proxy: n, headless: s }) {
      return s ? se({
        proxy: n,
        host: t.httpHost,
        port: t.httpPort
      }) : {
        kind: "programmatic",
        baseUrl: null
      };
    }
  };
}
k(Ae());
export {
  oe as DependencyInstaller,
  xe as MemoryVolume,
  Ee as Nodepod,
  ie as NodepodFS,
  je as NodepodFSClient,
  be as NodepodFSClientError,
  Pe as NodepodProcess,
  He as NodepodSWSetupError,
  we as RequestProxy,
  ve as WorkspacePersistence,
  ce as createFsWorkspaceStore,
  Xe as createIndexedDBWorkspaceStore,
  se as createLocalHttpIngress,
  ye as createMemoryWorkspaceStore,
  Ae as createNodeHost,
  le as deleteIndexedDBWorkspace,
  Le as discoverWorkspaces,
  Be as getProxyInstance,
  Ie as getRuntimeHost,
  Qe as install,
  Fe as listIndexedDBWorkspaces,
  re as openFsSnapshotCache,
  Ce as readWorkspacePatterns,
  ge as resetProxy,
  De as resetRuntimeHost,
  k as setRuntimeHost
};

//# sourceMappingURL=headless.mjs.map