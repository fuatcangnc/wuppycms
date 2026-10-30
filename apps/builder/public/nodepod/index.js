import { c as de, d as b, o as ce, s as we } from "./event-loop-CGuYUIBq.js";
import { r as D } from "./fast-pako-BwXotfTx.js";
import { A as I, B as le, C as he, D as O, Dt as ge, E as ye, F as Z, H as Be, I as j, Kt as Fe, L as pe, Lt as Ae, M as Ce, Mt as xe, N as Xe, O as Pe, P as Ee, Pt as me, R as Le, Rt as ve, T as Ge, V as be, X as De, Xt as Ie, a as Oe, c as Ze, cn as H, d as je, dn as He, f as We, i as Ye, j as ze, jt as Me, k as Ue, l as ke, ln as W, mn as Y, n as Qe, o as Je, on as Se, r as Ne, s as Te, sn as Ve, t as Re, un as qe, w as Ke, z as _e } from "./nodepod-Y98NXDvC.js";
import { c as z, d as et, f as P, l as M, m as tt, p as rt, u as nt } from "./offload-BQq4ymyv.js";
import { I as it } from "./tarball-cache-__C0n2zb.js";
import "./config-BBz1Tu7H.js";
import { a as ct, b as wt, c as ut, d as ft, f as lt, h as ht, l as gt, m as yt, n as Bt, p as Ft, t as E, u as pt, v as At, x as Ct, y as xt } from "./script-engine-CtRdZ7fx.js";
import { d as Pt, o as Et, u as mt } from "./registry-client-BV27YIBO.js";
var Lt = /* @__PURE__ */ b({ openSnapshotCache: () => L }), U = "nodepod-snapshots", w = "snapshots", k = 2, Q = 6048e5, m = 3, u = "\0data\0";
function J() {
  const e = globalThis.crypto;
  return e && typeof e.randomUUID == "function" ? e.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function S() {
  return typeof indexedDB > "u" ? Promise.resolve(null) : new Promise((e) => {
    try {
      const t = indexedDB.open(U, k);
      t.onupgradeneeded = () => {
        const r = t.result;
        r.objectStoreNames.contains(w) || r.createObjectStore(w);
      }, t.onsuccess = () => e(t.result), t.onerror = () => e(null);
    } catch {
      e(null);
    }
  });
}
function l(e, t) {
  return new Promise((r, i) => {
    const s = e.transaction(w, "readonly").objectStore(w).get(t);
    s.onsuccess = () => r(s.result ?? null), s.onerror = () => i(s.error);
  });
}
function N(e, t, r = []) {
  return new Promise((i, s) => {
    const n = e.transaction(w, "readwrite"), o = n.objectStore(w);
    for (const a of r) o.delete(a);
    for (const [a, d] of t) o.put(d, a);
    n.oncomplete = () => i(), n.onerror = () => s(n.error), n.onabort = () => s(n.error);
  });
}
function p(e) {
  return !!e && e.schema === m && Array.isArray(e.manifest) && typeof e.version == "string" && !(e.createdAt && Date.now() - e.createdAt > Q);
}
function T(e) {
  try {
    const t = e.transaction(w, "readwrite").objectStore(w), r = t.openCursor(), i = /* @__PURE__ */ new Set(), s = [];
    r.onsuccess = () => {
      const n = r.result;
      if (!n) {
        for (const a of s) i.has(a) || t.delete(a);
        return;
      }
      const o = String(n.key);
      o.includes(u) ? s.push(o) : p(n.value) ? i.add(o + u + n.value.version) : n.delete(), n.continue();
    };
  } catch {
  }
}
var A = null;
function V() {
  return typeof Blob > "u" || typeof indexedDB > "u" ? Promise.resolve(!1) : (A ??= new Promise((e) => {
    let t = !1;
    const r = (i) => {
      t || (t = !0, e(i));
    };
    setTimeout(() => r(!1), 2e3);
    try {
      const i = indexedDB.open("nodepod-blob-probe", 1);
      i.onupgradeneeded = () => i.result.createObjectStore("probe"), i.onerror = () => r(!1), i.onsuccess = () => {
        const s = i.result, n = (o) => {
          s.close(), r(o);
          try {
            indexedDB.deleteDatabase("nodepod-blob-probe");
          } catch {
          }
        };
        try {
          const o = s.transaction("probe", "readwrite");
          o.objectStore("probe").put(new Blob([new Uint8Array([1])]), "probe"), o.oncomplete = () => n(!0), o.onerror = () => n(!1), o.onabort = () => n(!1);
        } catch {
          n(!1);
        }
      };
    } catch {
      r(!1);
    }
  }), A);
}
function R(e, t) {
  const r = e.length === 1 ? e[0] : null;
  if (r && r.byteOffset === 0 && r.byteLength === r.buffer.byteLength && r.buffer instanceof ArrayBuffer) return r.buffer;
  const i = new Uint8Array(t);
  let s = 0;
  for (const n of e)
    i.set(n, s), s += n.byteLength;
  return i.buffer;
}
async function q(e) {
  return e instanceof ArrayBuffer ? new Uint8Array(e) : typeof Blob < "u" && e instanceof Blob ? new Uint8Array(await e.arrayBuffer()) : null;
}
async function L() {
  const e = await S();
  if (!e) return null;
  T(e);
  const t = /* @__PURE__ */ new Map(), r = async (s, n) => {
    const o = s + u + n, a = t.get(o);
    if (a) return a;
    const d = await l(e, o);
    return !(d instanceof ArrayBuffer) && !(typeof Blob < "u" && d instanceof Blob) ? null : (typeof Blob < "u" && d instanceof Blob && t.set(o, d), d);
  }, i = async (s, n, o, a) => {
    try {
      const d = await l(e, s), c = {
        schema: m,
        manifest: n,
        byteLength: a,
        createdAt: Date.now(),
        version: J()
      }, f = await V() ? new Blob(o) : R(o, a);
      await N(e, [[s, c], [s + u + c.version, f]], d?.version ? [s + u + d.version] : []);
    } catch {
    }
  };
  return {
    async get(s) {
      try {
        const n = await l(e, s);
        if (!p(n)) return null;
        const o = await q(await r(s, n.version));
        if (!o || o.byteLength !== n.byteLength) return null;
        const a = o.byteOffset === 0 && o.byteLength === o.buffer.byteLength ? o.buffer : o.slice().buffer;
        return {
          manifest: n.manifest,
          data: a
        };
      } catch {
        return null;
      }
    },
    set(s, n) {
      return i(s, n.manifest, [new Uint8Array(n.data)], n.data.byteLength);
    },
    setParts: i,
    async getManifest(s) {
      try {
        const n = await l(e, s);
        return p(n) ? {
          manifest: n.manifest,
          version: n.version
        } : null;
      } catch {
        return null;
      }
    },
    async readRange(s, n, o, a) {
      try {
        const d = await r(s, n);
        return d ? d instanceof ArrayBuffer ? new Uint8Array(d.slice(o, o + a)) : new Uint8Array(await d.slice(o, o + a).arrayBuffer()) : null;
      } catch {
        return t.delete(s + u + n), null;
      }
    },
    close() {
      t.clear();
      try {
        e.close();
      } catch {
      }
    }
  };
}
var K = "nodepod-package-packs-v1", C = 1;
async function x(e, t, r) {
  const i = await (await e.getFileHandle(t, { create: !0 })).createWritable();
  try {
    await i.write(r);
  } finally {
    await i.close();
  }
}
function y(e, t) {
  return t.dataFile ?? `${encodeURIComponent(e)}.bin`;
}
async function _() {
  const e = typeof navigator < "u" ? navigator.storage : null;
  if (!e?.getDirectory) return null;
  try {
    const t = await (await e.getDirectory()).getDirectoryHandle(K, { create: !0 }), r = async (n) => {
      try {
        const o = await t.getFileHandle(`${encodeURIComponent(n)}.json`), a = JSON.parse(await (await o.getFile()).text());
        return a?.schema !== C || !Array.isArray(a.manifest) ? null : a;
      } catch {
        return null;
      }
    }, i = /* @__PURE__ */ new Map(), s = async (n) => {
      const o = i.get(n);
      if (o) return o;
      const a = await (await t.getFileHandle(n)).getFile();
      return i.set(n, a), a;
    };
    return {
      async get(n) {
        const o = await r(n);
        if (!o) return null;
        try {
          const a = await (await (await t.getFileHandle(y(n, o))).getFile()).arrayBuffer();
          return a.byteLength !== o.byteLength ? null : {
            manifest: o.manifest,
            data: a
          };
        } catch {
          return null;
        }
      },
      async set(n, o) {
        const a = encodeURIComponent(n), d = await r(n), c = `${a}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.bin`;
        try {
          await x(t, c, o.data), await x(t, `${a}.json`, JSON.stringify({
            schema: C,
            createdAt: Date.now(),
            byteLength: o.data.byteLength,
            manifest: o.manifest,
            dataFile: c
          })), d && await t.removeEntry(y(n, d)).catch(() => {
          });
        } catch {
        }
      },
      async getManifest(n) {
        const o = await r(n);
        return o ? {
          manifest: o.manifest,
          version: y(n, o)
        } : null;
      },
      async readRange(n, o, a, d) {
        try {
          const c = await s(o);
          return a + d > c.size ? null : new Uint8Array(await c.slice(a, a + d).arrayBuffer());
        } catch {
          return i.delete(o), null;
        }
      },
      close() {
        i.clear();
      }
    };
  } catch {
    return null;
  }
}
function h(e, t) {
  const r = e;
  return t && (r.__nodepodRevokeUrl = t), r;
}
function g() {
  let e = null, t = null, r = null;
  function i() {
    if (r) return r;
    const s = atob(Y), n = new Uint8Array(s.length);
    for (let d = 0; d < s.length; d++) n[d] = s.charCodeAt(d);
    const o = D(n, { to: "string" }), a = new Blob([o], { type: "application/javascript" });
    return r = URL.createObjectURL(a), r;
  }
  return {
    kind: "browser",
    canCreateWorkers() {
      return typeof Worker < "u" && typeof Blob < "u" && typeof URL < "u" && typeof URL.createObjectURL == "function";
    },
    createWorker(s) {
      if (typeof Worker > "u") throw new Error("[Nodepod] Web Workers are required.");
      if (s.type === "url") {
        const o = h(new Worker(s.url, { name: s.name }));
        return o.__nodepodDirect = !0, o;
      }
      if (s.type === "source") {
        const o = URL.createObjectURL(new Blob([s.source], { type: "application/javascript" }));
        return h(new Worker(o, { name: s.name }), o);
      }
      if (!s.embedded && e) try {
        const o = h(new Worker(e, { name: s.name }));
        return o.__nodepodDirect = !0, o;
      } catch {
        e = null;
      }
      const n = i();
      return h(new Worker(n, { name: s.name }));
    },
    async probeProcessWorkerUrl(s) {
      return t || (t = (async () => {
        if (typeof fetch > "u") return null;
        let n = s ?? null;
        if (!n) {
          try {
            n = new URL("./__worker__.js", "" + import.meta.url).href;
          } catch {
            return null;
          }
          if (!/^https?:/.test(n)) return null;
        }
        try {
          const o = await fetch(n, { method: "HEAD" });
          if (!o.ok) return null;
          const a = o.headers.get("content-type") || "";
          return a && !/javascript|ecmascript/i.test(a) ? null : (e = n, n);
        } catch {
          return null;
        }
      })(), t);
    },
    revokeObjectUrl(s) {
      try {
        URL.revokeObjectURL(s);
      } catch {
      }
      s === r && (r = null);
    },
    disposeGlobalResources() {
      if (r) {
        try {
          URL.revokeObjectURL(r);
        } catch {
        }
        r = null;
      }
      e = null, t = null;
    },
    async openSnapshotCache(s) {
      if (s.enableSnapshotCache === !1 || s.packageStore === "memory") return null;
      try {
        if (s.packageStore === "opfs") {
          const n = await _();
          if (n) return n;
        }
        return await L();
      } catch {
        return null;
      }
    },
    async openWorkspaceStore(s) {
      return W(s);
    },
    createHttpIngress() {
      return {
        kind: "programmatic",
        baseUrl: null
      };
    }
  };
}
globalThis.__NODEPOD_CREATE_BROWSER_HOST__ = g;
P(g);
function $() {
  const e = import.meta.url, t = new globalThis.URL("./threading/engine-worker.ts", e);
  return new globalThis.Worker(t, { type: "module" });
}
var ee = class {
  thread;
  endpoint;
  vol;
  cfg;
  ready;
  onFileChange = null;
  onFileDelete = null;
  constructor(e, t = {}) {
    this.vol = e, this.cfg = t, this.thread = $(), this.endpoint = M(this.thread), this.ready = this.bootstrap(), this.attachVolumeSync();
  }
  async bootstrap() {
    const e = this.vol.toSnapshot(), t = {
      cwd: this.cfg.cwd,
      env: this.cfg.env
    };
    await this.endpoint.init(e, t), this.cfg.onConsole && await this.endpoint.setConsoleForwarder(z(this.cfg.onConsole));
  }
  attachVolumeSync() {
    this.onFileChange = (e, t) => {
      this.endpoint.syncFile(e, t);
    }, this.vol.on("write", this.onFileChange), this.onFileDelete = (e) => {
      this.endpoint.syncFile(e, null);
    }, this.vol.on("delete", this.onFileDelete);
  }
  async execute(e, t) {
    return await this.ready, this.endpoint.execute(e, t);
  }
  async runFile(e) {
    return await this.ready, this.endpoint.runFile(e);
  }
  clearCache() {
    this.endpoint.clearCache();
  }
  getVolume() {
    return this.vol;
  }
  terminate() {
    this.onFileChange && this.vol.off("write", this.onFileChange), this.onFileDelete && this.vol.off("delete", this.onFileDelete), this.thread.terminate();
  }
}, te = class {
  frame;
  targetOrigin;
  vol;
  cfg;
  ready;
  pendingCalls = /* @__PURE__ */ new Map();
  nextId = 0;
  onFileChange = null;
  onFileDelete = null;
  onMessage = null;
  constructor(e, t, r = {}) {
    this.targetOrigin = new URL(e).origin, this.vol = t, this.cfg = r, this.frame = document.createElement("iframe"), this.frame.src = e, this.frame.style.display = "none", this.frame.credentialless = !0, this.frame.setAttribute("credentialless", ""), this.frame.setAttribute("sandbox", "allow-scripts"), document.body.appendChild(this.frame), this.bindMessageHandler(), this.ready = this.awaitReady().then(() => this.sendInit()), this.attachVolumeSync();
  }
  bindMessageHandler() {
    this.onMessage = (e) => {
      if (e.origin !== "null" && e.origin !== this.targetOrigin) return;
      const t = e.data;
      if (t.type === "result" && t.id) {
        const r = this.pendingCalls.get(t.id);
        r && t.result && (r.resolve(t.result), this.pendingCalls.delete(t.id));
      } else if (t.type === "error" && t.id) {
        const r = this.pendingCalls.get(t.id);
        r && (r.reject(new Error(t.error || "Sandbox error")), this.pendingCalls.delete(t.id));
      } else t.type === "console" && this.cfg.onConsole && this.cfg.onConsole(t.consoleMethod || "log", t.consoleArgs || []);
    }, window.addEventListener("message", this.onMessage);
  }
  awaitReady() {
    return new Promise((e) => {
      const t = (r) => {
        r.origin !== "null" && r.origin !== this.targetOrigin || r.data.type === "ready" && (window.removeEventListener("message", t), e());
      };
      window.addEventListener("message", t);
    });
  }
  async sendInit() {
    const e = {
      type: "init",
      snapshot: this.vol.toSnapshot(),
      config: {
        cwd: this.cfg.cwd,
        env: this.cfg.env
      }
    };
    this.frame.contentWindow?.postMessage(e, "*");
  }
  attachVolumeSync() {
    this.onFileChange = (e, t) => {
      const r = typeof SharedArrayBuffer < "u" && t.buffer instanceof SharedArrayBuffer ? new Uint8Array(t) : t;
      this.frame.contentWindow?.postMessage({
        type: "syncFile",
        path: e,
        content: r
      }, "*");
    }, this.vol.on("write", this.onFileChange), this.onFileDelete = (e) => {
      this.frame.contentWindow?.postMessage({
        type: "syncFile",
        path: e,
        content: null
      }, "*");
    }, this.vol.on("delete", this.onFileDelete);
  }
  dispatch(e) {
    return new Promise((t, r) => {
      const i = String(this.nextId++);
      this.pendingCalls.set(i, {
        resolve: t,
        reject: r
      }), this.frame.contentWindow?.postMessage({
        ...e,
        id: i
      }, "*"), setTimeout(() => {
        this.pendingCalls.has(i) && (this.pendingCalls.delete(i), r(/* @__PURE__ */ new Error("Sandbox execution timeout")));
      }, 6e4);
    });
  }
  async execute(e, t) {
    return await this.ready, this.dispatch({
      type: "execute",
      code: e,
      filename: t
    });
  }
  async runFile(e) {
    return await this.ready, this.dispatch({
      type: "runFile",
      filename: e
    });
  }
  clearCache() {
    this.frame.contentWindow?.postMessage({ type: "clearCache" }, "*");
  }
  getVolume() {
    return this.vol;
  }
  terminate() {
    this.onFileChange && this.vol.off("write", this.onFileChange), this.onFileDelete && this.vol.off("delete", this.onFileDelete), this.onMessage && window.removeEventListener("message", this.onMessage), this.frame.remove();
    for (const [, { reject: e }] of this.pendingCalls) e(/* @__PURE__ */ new Error("Sandbox terminated"));
    this.pendingCalls.clear();
  }
};
function X() {
  return typeof Worker < "u";
}
var re = class {
  engine;
  constructor(e, t = {}) {
    this.engine = new E(e, t);
  }
  async execute(e, t) {
    return Promise.resolve(this.engine.execute(e, t));
  }
  async runFile(e) {
    return Promise.resolve(this.engine.runFile(e));
  }
  clearCache() {
    this.engine.clearCache();
  }
  getVolume() {
    return this.engine.getVolume();
  }
  unwrap() {
    return this.engine;
  }
};
async function vt(e, t = {}) {
  const { sandboxUrl: r, allowUnsafeEval: i, useWorker: s = !1, ...n } = t;
  if (r) {
    const a = new te(r, e, n);
    return await a.execute("/* sandbox ready check */", "/__sandbox_init__.js"), a;
  }
  if (!i) throw new Error(`nodepod: For security, you must either:
  1. Use sandbox mode: { sandboxUrl: "https://your-sandbox.example.com" }
  2. Explicitly opt-in to same-origin: { allowUnsafeEval: true }

Same-origin execution allows code to access cookies, localStorage, and IndexedDB.
Only use allowUnsafeEval for trusted code or demos.`);
  let o = !1;
  if ((s === !0 || s === "auto") && (o = X()), o) {
    const a = new ee(e, n);
    return await a.execute("/* worker ready check */", "/__worker_init__.js"), a;
  }
  return new re(e, n);
}
var ne = class {
  _vol;
  _processManager;
  _vfsBridge;
  _cfg;
  constructor(e, t = {}) {
    this._vol = e, this._cfg = t, this._processManager = new j(e), this._vfsBridge = new Z(e), this._processManager.setVFSBridge(this._vfsBridge), this._vfsBridge.setBroadcaster((r, i, s, n) => {
      this._processManager.broadcastVFSChange(r, i, s, n);
    });
  }
  async execute(e, t) {
    const r = t ?? "/__exec_tmp__.js";
    return this._vol.writeFileSync(r, e), await this._runInWorker(r);
  }
  async runFile(e) {
    return this._runInWorker(e);
  }
  async _runInWorker(e) {
    return new Promise((t) => {
      const r = this._processManager.spawn({
        command: "node",
        args: [e],
        cwd: this._cfg.cwd ?? "/",
        env: this._cfg.env ?? {}
      });
      let i = "", s = "";
      r.on("stdout", (n) => {
        i += n;
      }), r.on("stderr", (n) => {
        s += n;
      }), r.on("ready", () => {
        r.exec({
          type: "exec",
          filePath: e,
          args: [],
          cwd: this._cfg.cwd,
          env: this._cfg.env
        });
      }), r.on("exit", (n) => {
        t({
          exports: {},
          module: {
            id: e,
            filename: e,
            exports: {},
            loaded: !0,
            children: [],
            paths: []
          }
        });
      });
    });
  }
  clearCache() {
  }
  getVolume() {
    return this._vol;
  }
  getProcessManager() {
    return this._processManager;
  }
  teardown() {
    this._processManager.teardown();
  }
};
async function Gt(e, t = {}) {
  return new ne(e, t);
}
function se() {
  try {
    const e = globalThis.require;
    if (typeof e != "function") return null;
    const t = e("fs"), r = e("path");
    let i;
    try {
      const n = e("url");
      i = r.dirname(n.fileURLToPath(import.meta.url));
    } catch {
      i = typeof __dirname < "u" ? __dirname : ".";
    }
    let s = r.join(i, "__sw__.js");
    return t.existsSync(s) || (s = r.join(i, "../dist/__sw__.js"), t.existsSync(s)) ? t.readFileSync(s, "utf-8") : null;
  } catch {
    return null;
  }
}
function ie(e = {}) {
  const t = typeof e == "string" ? { nodepodUrl: e } : e, r = t.nodepodUrl ?? "https://unpkg.com/@r1ck404/nodepod/dist/index.js", i = t.enableServiceWorker ?? !0, s = t.parentOrigin ? JSON.stringify(t.parentOrigin) : "'*'";
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Nodepod Sandbox</title></head>
<body>
<script type="module">
  import { MemoryVolume, ScriptEngine } from '${r}';
${i ? `
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/__sw__.js', { scope: '/' })
      .then(() => console.log('[Sandbox] SW registered'))
      .catch(e => console.warn('[Sandbox] SW failed:', e));
  }
` : ""}
  const PARENT_ORIGIN = ${s};
  let volume = null;
  let engine = null;

  window.addEventListener('message', async (event) => {
    if (PARENT_ORIGIN !== '*' && event.origin !== PARENT_ORIGIN) return;
    const { type, id, code, filename, snapshot, config, path, content } = event.data;
    try {
      switch (type) {
        case 'init':
          volume = MemoryVolume.fromSnapshot(snapshot);
          engine = new ScriptEngine(volume, {
            cwd: config?.cwd,
            env: config?.env,
            onConsole: (method, args) => {
              parent.postMessage({ type: 'console', consoleMethod: method, consoleArgs: args }, PARENT_ORIGIN);
            },
          });
          break;
        case 'syncFile':
          if (volume) {
            if (content === null) { try { volume.unlinkSync(path); } catch {} }
            else { volume.writeFileSync(path, content); }
          }
          break;
        case 'execute':
          if (!engine) { parent.postMessage({ type: 'error', id, error: 'Engine not initialized' }, PARENT_ORIGIN); return; }
          parent.postMessage({ type: 'result', id, result: engine.execute(code, filename) }, PARENT_ORIGIN);
          break;
        case 'runFile':
          if (!engine) { parent.postMessage({ type: 'error', id, error: 'Engine not initialized' }, PARENT_ORIGIN); return; }
          parent.postMessage({ type: 'result', id, result: engine.runFile(filename) }, PARENT_ORIGIN);
          break;
        case 'clearCache':
          if (engine) engine.clearCache();
          break;
      }
    } catch (err) {
      if (id) parent.postMessage({ type: 'error', id, error: err instanceof Error ? err.message : String(err) }, PARENT_ORIGIN);
    }
  });

  parent.postMessage({ type: 'ready' }, PARENT_ORIGIN);
<\/script>
</body>
</html>`;
}
function oe() {
  return { headers: [{
    source: "/(.*)",
    headers: [{
      key: "Access-Control-Allow-Origin",
      value: "*"
    }, {
      key: "Cross-Origin-Resource-Policy",
      value: "cross-origin"
    }]
  }] };
}
function bt(e = {}) {
  const t = typeof e == "string" ? { nodepodUrl: e } : e, r = t.enableServiceWorker ?? !0 ? se() : null, i = {
    "index.html": ie(t),
    "vercel.json": JSON.stringify(oe(), null, 2)
  };
  return r && (i["__sw__.js"] = r), i;
}
var Dt = `
# Deploying a Nodepod Sandbox

## 1. Generate sandbox files
   Use generateSandboxDeployment() to create the required files.

## 2. Deploy to a hosting provider
   cd sandbox && vercel --prod

## 3. Use in your app
   const engine = await spawnEngine(volume, {
     sandboxUrl: 'https://your-sandbox.example.com'
   });
`.trim(), It = class {
  _files = /* @__PURE__ */ new Map();
  _dirs = /* @__PURE__ */ new Set();
  _onWrite = null;
  _onDelete = null;
  _decoder = new TextDecoder();
  _encoder = new TextEncoder();
  constructor() {
    this._dirs.add("/");
  }
  initFromSnapshot(e) {
    const t = new Uint8Array(e.data);
    for (const r of e.manifest) r.isDirectory ? this._dirs.add(r.path) : (this._files.set(r.path, t.slice(r.offset, r.offset + r.length)), this._ensureParentDirs(r.path));
  }
  setWriteCallback(e) {
    this._onWrite = e;
  }
  setDeleteCallback(e) {
    this._onDelete = e;
  }
  readFileSync(e, t) {
    const r = this._files.get(e);
    if (!r) {
      const i = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, open '${e}'`);
      throw i.code = "ENOENT", i.errno = -2, i;
    }
    if (t === "utf8" || t === "utf-8") {
      if (typeof SharedArrayBuffer < "u" && r.buffer instanceof SharedArrayBuffer) {
        const i = new Uint8Array(r.byteLength);
        return i.set(r), this._decoder.decode(i);
      }
      return this._decoder.decode(r);
    }
    return new Uint8Array(r);
  }
  existsSync(e) {
    return this._files.has(e) || this._dirs.has(e);
  }
  statSync(e) {
    if (this._dirs.has(e)) return {
      isFile: () => !1,
      isDirectory: () => !0,
      size: 0
    };
    const t = this._files.get(e);
    if (t) return {
      isFile: () => !0,
      isDirectory: () => !1,
      size: t.byteLength
    };
    const r = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, stat '${e}'`);
    throw r.code = "ENOENT", r.errno = -2, r;
  }
  readdirSync(e) {
    if (!this._dirs.has(e)) {
      const i = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, scandir '${e}'`);
      throw i.code = "ENOENT", i.errno = -2, i;
    }
    const t = e === "/" ? "/" : e + "/", r = /* @__PURE__ */ new Set();
    for (const i of this._files.keys()) if (i.startsWith(t)) {
      const s = i.slice(t.length), n = s.indexOf("/");
      r.add(n === -1 ? s : s.slice(0, n));
    }
    for (const i of this._dirs) if (i.startsWith(t) && i !== e) {
      const s = i.slice(t.length), n = s.indexOf("/");
      r.add(n === -1 ? s : s.slice(0, n));
    }
    return Array.from(r).filter(Boolean).sort();
  }
  writeFileSync(e, t) {
    const r = typeof t == "string" ? this._encoder.encode(t) : new Uint8Array(t);
    this._files.set(e, r), this._ensureParentDirs(e), this._onWrite && this._onWrite(e, r, !1);
  }
  mkdirSync(e, t) {
    if (!this._dirs.has(e))
      if (t?.recursive) {
        const r = e.split("/").filter(Boolean);
        let i = "";
        for (const s of r)
          i += "/" + s, this._dirs.has(i) || (this._dirs.add(i), this._onWrite && this._onWrite(i, /* @__PURE__ */ new Uint8Array(0), !0));
      } else
        this._dirs.add(e), this._onWrite && this._onWrite(e, /* @__PURE__ */ new Uint8Array(0), !0);
  }
  unlinkSync(e) {
    if (!this._files.has(e)) {
      const t = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, unlink '${e}'`);
      throw t.code = "ENOENT", t.errno = -2, t;
    }
    this._files.delete(e), this._onDelete && this._onDelete(e);
  }
  rmdirSync(e) {
    this._dirs.delete(e), this._onDelete && this._onDelete(e);
  }
  renameSync(e, t) {
    const r = this._files.get(e);
    r ? (this._files.delete(e), this._files.set(t, r), this._onDelete && this._onDelete(e), this._onWrite && this._onWrite(t, r, !1)) : this._dirs.has(e) && (this._dirs.delete(e), this._dirs.add(t), this._onDelete && this._onDelete(e), this._onWrite && this._onWrite(t, /* @__PURE__ */ new Uint8Array(0), !0));
  }
  appendFileSync(e, t) {
    const r = this._files.get(e) ?? /* @__PURE__ */ new Uint8Array(0), i = typeof t == "string" ? this._encoder.encode(t) : new Uint8Array(t), s = new Uint8Array(r.byteLength + i.byteLength);
    s.set(r, 0), s.set(i, r.byteLength), this._files.set(e, s), this._ensureParentDirs(e), this._onWrite && this._onWrite(e, s, !1);
  }
  copyFileSync(e, t) {
    const r = this._files.get(e);
    if (!r) {
      const s = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, copyfile '${e}'`);
      throw s.code = "ENOENT", s.errno = -2, s;
    }
    const i = new Uint8Array(r);
    this._files.set(t, i), this._ensureParentDirs(t), this._onWrite && this._onWrite(t, i, !1);
  }
  applySync(e, t, r) {
    t === null ? (this._files.delete(e), this._dirs.delete(e)) : r ? this._dirs.add(e) : (this._files.set(e, new Uint8Array(t)), this._ensureParentDirs(e));
  }
  _ensureParentDirs(e) {
    const t = e.split("/").filter(Boolean);
    let r = "";
    for (let i = 0; i < t.length - 1; i++)
      r += "/" + t[i], this._dirs.add(r);
  }
  get fileCount() {
    return this._files.size;
  }
  get dirCount() {
    return this._dirs.size;
  }
};
P(g);
globalThis.__NODEPOD_CREATE_BROWSER_HOST__ = g;
var B = null;
async function F() {
  return B || (B = await import("./child_process-Bqy_wS0P.js")), B;
}
function Ot(e) {
  const t = new H(), r = new E(t, e), i = new I(t, { cwd: e?.cwd }), s = O({
    baseUrl: e?.baseUrl,
    onServerReady: e?.onServerReady
  });
  return F().then((n) => n.initShellExec(t, { cwd: e?.cwd })), {
    volume: t,
    engine: r,
    packages: i,
    proxy: s,
    execute: (n, o) => r.execute(n, o),
    runFile: (n) => r.runFile(n),
    run: async (n, o) => {
      if (o?.signal?.aborted) return {
        stdout: "",
        stderr: "",
        exitCode: 130
      };
      const a = await F(), d = o?.onStdout || o?.onStderr || o?.signal;
      return d && a.setStreamingCallbacks({
        onStdout: o?.onStdout,
        onStderr: o?.onStderr,
        signal: o?.signal
      }), new Promise((c) => {
        a.exec(n, { cwd: o?.cwd }, (f, v, G) => {
          d && a.clearStreamingCallbacks(), c({
            stdout: String(v),
            stderr: String(G),
            exitCode: f ? f.code ?? 1 : 0
          });
        });
      });
    },
    sendInput: async (n) => {
      (await F()).sendStdin(n);
    },
    createREPL: () => r.createREPL(),
    on: (n, o) => {
      s.on(n, o);
    }
  };
}
export {
  I as DependencyInstaller,
  te as IframeSandbox,
  Se as LRUCache,
  Ve as MemoryHandler,
  H as MemoryVolume,
  Re as Nodepod,
  Ge as NodepodFS,
  je as NodepodFSClient,
  We as NodepodFSClientError,
  Ke as NodepodProcess,
  Ue as NodepodSWSetupError,
  he as NodepodTerminal,
  Ye as PreviewAgentUnavailableError,
  Oe as PreviewInspectionTimeoutError,
  Je as PreviewInspector,
  Te as PreviewInspectorError,
  Ze as PreviewNotAttachedError,
  ke as PreviewScreenshotUnavailableError,
  Be as ProcessHandle,
  j as ProcessManager,
  ne as ProcessWorkerAdapter,
  ye as RequestProxy,
  Dt as SANDBOX_DEPLOYMENT_GUIDE,
  E as ScriptEngine,
  _e as SharedVFSController,
  le as SharedVFSReader,
  pe as SyncChannelController,
  Le as SyncChannelWorker,
  Z as VFSBridge,
  ee as WorkerSandbox,
  It as WorkerVFS,
  Ne as WorkspacePersistence,
  ct as assert,
  ve as buildFileSystemBridge,
  xt as buildProcessEnv,
  ht as chokidar,
  g as createBrowserHost,
  W as createIndexedDBWorkspaceStore,
  Qe as createMemoryWorkspaceStore,
  ce as createProcessContext,
  Ot as createWorkspace,
  Ot as default,
  qe as deleteIndexedDBWorkspace,
  Xe as discoverWorkspaces,
  nt as ensureRuntimeHost,
  De as esbuild,
  Ie as events,
  Bt as executeCode,
  Ft as fsevents,
  bt as generateSandboxDeployment,
  we as getActiveContext,
  Et as getCorsProxy,
  O as getProxyInstance,
  et as getRuntimeHost,
  oe as getSandboxHostingConfig,
  ie as getSandboxPageHtml,
  ge as http,
  ze as install,
  Me as installFetchHeadersSetCookieParity,
  xe as installNodeFetchClassParity,
  be as isSharedArrayBufferAvailable,
  He as listIndexedDBWorkspaces,
  ft as module,
  Ae as net,
  Ce as npm,
  it as path,
  pt as perf_hooks,
  Ct as querystring,
  Ee as readWorkspacePatterns,
  lt as readdirp,
  Pe as resetProxy,
  rt as resetRuntimeHost,
  ut as rollup,
  de as setActiveContext,
  mt as setAllowedDomains,
  Pt as setCorsProxy,
  me as setFetchResponse,
  tt as setRuntimeHost,
  vt as spawnEngine,
  Gt as spawnProcessWorkerEngine,
  Fe as stream,
  Lt as t,
  wt as url,
  At as util,
  gt as worker_threads,
  yt as ws
};

//# sourceMappingURL=index.mjs.map