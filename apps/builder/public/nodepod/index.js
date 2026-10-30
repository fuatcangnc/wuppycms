import { c as ae, d as D, o as de, s as fe } from "./event-loop-CGuYUIBq.js";
import { r as P } from "./fast-pako-BwXotfTx.js";
import { A as O, B as Ae, C as ge, D as I, Dt as we, E as Be, F as p, H as xe, I as m, Kt as Ce, L as ye, Lt as Le, M as be, Mt as Fe, N as he, O as je, P as ve, Pt as Qe, R as Ee, Rt as He, T as Xe, V as De, X as Pe, Xt as Oe, a as Ie, c as pe, cn as U, d as me, dn as Ue, f as We, i as Me, j as Ye, jt as ze, k as Ge, l as Re, ln as W, mn as M, n as ke, o as Ke, on as Ne, r as Se, s as Ze, sn as Te, t as qe, un as Je, w as Ve, z as _e } from "./nodepod-x22a8Pmu.js";
import { c as Y, d as et, f as j, l as z, m as tt, p as nt, u as st } from "./offload-DgyAYqvz.js";
import { I as it } from "./tarball-cache-__C0n2zb.js";
import "./config-CDCaUbLv.js";
import { a as dt, b as ft, c as ut, d as lt, f as At, h as gt, l as wt, m as Bt, n as xt, p as Ct, t as v, u as yt, v as Lt, x as bt, y as Ft } from "./script-engine-CqbllEIG.js";
import { d as jt, o as vt, u as Qt } from "./registry-client-BDeaTBMb.js";
var Et = /* @__PURE__ */ D({ openSnapshotCache: () => E }), G = "nodepod-snapshots", f = "snapshots", R = 2, k = 6048e5, Q = 3, u = "\0data\0";
function K() {
  const e = globalThis.crypto;
  return e && typeof e.randomUUID == "function" ? e.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function N() {
  return typeof indexedDB > "u" ? Promise.resolve(null) : new Promise((e) => {
    try {
      const t = indexedDB.open(G, R);
      t.onupgradeneeded = () => {
        const n = t.result;
        n.objectStoreNames.contains(f) || n.createObjectStore(f);
      }, t.onsuccess = () => e(t.result), t.onerror = () => e(null);
    } catch {
      e(null);
    }
  });
}
function A(e, t) {
  return new Promise((n, i) => {
    const r = e.transaction(f, "readonly").objectStore(f).get(t);
    r.onsuccess = () => n(r.result ?? null), r.onerror = () => i(r.error);
  });
}
function S(e, t, n = []) {
  return new Promise((i, r) => {
    const s = e.transaction(f, "readwrite"), c = s.objectStore(f);
    for (const o of n) c.delete(o);
    for (const [o, a] of t) c.put(a, o);
    s.oncomplete = () => i(), s.onerror = () => r(s.error), s.onabort = () => r(s.error);
  });
}
function y(e) {
  return !!e && e.schema === Q && Array.isArray(e.manifest) && typeof e.version == "string" && !(e.createdAt && Date.now() - e.createdAt > k);
}
function Z(e) {
  try {
    const t = e.transaction(f, "readwrite").objectStore(f), n = t.openCursor(), i = /* @__PURE__ */ new Set(), r = [];
    n.onsuccess = () => {
      const s = n.result;
      if (!s) {
        for (const o of r) i.has(o) || t.delete(o);
        return;
      }
      const c = String(s.key);
      c.includes(u) ? r.push(c) : y(s.value) ? i.add(c + u + s.value.version) : s.delete(), s.continue();
    };
  } catch {
  }
}
var L = null;
function T() {
  return typeof Blob > "u" || typeof indexedDB > "u" ? Promise.resolve(!1) : (L ??= new Promise((e) => {
    let t = !1;
    const n = (i) => {
      t || (t = !0, e(i));
    };
    setTimeout(() => n(!1), 2e3);
    try {
      const i = indexedDB.open("nodepod-blob-probe", 1);
      i.onupgradeneeded = () => i.result.createObjectStore("probe"), i.onerror = () => n(!1), i.onsuccess = () => {
        const r = i.result, s = (c) => {
          r.close(), n(c);
          try {
            indexedDB.deleteDatabase("nodepod-blob-probe");
          } catch {
          }
        };
        try {
          const c = r.transaction("probe", "readwrite");
          c.objectStore("probe").put(new Blob([new Uint8Array([1])]), "probe"), c.oncomplete = () => s(!0), c.onerror = () => s(!1), c.onabort = () => s(!1);
        } catch {
          s(!1);
        }
      };
    } catch {
      n(!1);
    }
  }), L);
}
function q(e, t) {
  const n = e.length === 1 ? e[0] : null;
  if (n && n.byteOffset === 0 && n.byteLength === n.buffer.byteLength && n.buffer instanceof ArrayBuffer) return n.buffer;
  const i = new Uint8Array(t);
  let r = 0;
  for (const s of e)
    i.set(s, r), r += s.byteLength;
  return i.buffer;
}
async function J(e) {
  return e instanceof ArrayBuffer ? new Uint8Array(e) : typeof Blob < "u" && e instanceof Blob ? new Uint8Array(await e.arrayBuffer()) : null;
}
async function E() {
  const e = await N();
  if (!e) return null;
  Z(e);
  const t = /* @__PURE__ */ new Map(), n = async (r, s) => {
    const c = r + u + s, o = t.get(c);
    if (o) return o;
    const a = await A(e, c);
    return !(a instanceof ArrayBuffer) && !(typeof Blob < "u" && a instanceof Blob) ? null : (typeof Blob < "u" && a instanceof Blob && t.set(c, a), a);
  }, i = async (r, s, c, o) => {
    try {
      const a = await A(e, r), d = {
        schema: Q,
        manifest: s,
        byteLength: o,
        createdAt: Date.now(),
        version: K()
      }, l = await T() ? new Blob(c) : q(c, o);
      await S(e, [[r, d], [r + u + d.version, l]], a?.version ? [r + u + a.version] : []);
    } catch {
    }
  };
  return {
    async get(r) {
      try {
        const s = await A(e, r);
        if (!y(s)) return null;
        const c = await J(await n(r, s.version));
        if (!c || c.byteLength !== s.byteLength) return null;
        const o = c.byteOffset === 0 && c.byteLength === c.buffer.byteLength ? c.buffer : c.slice().buffer;
        return {
          manifest: s.manifest,
          data: o
        };
      } catch {
        return null;
      }
    },
    set(r, s) {
      return i(r, s.manifest, [new Uint8Array(s.data)], s.data.byteLength);
    },
    setParts: i,
    async getManifest(r) {
      try {
        const s = await A(e, r);
        return y(s) ? {
          manifest: s.manifest,
          version: s.version
        } : null;
      } catch {
        return null;
      }
    },
    async readRange(r, s, c, o) {
      try {
        const a = await n(r, s);
        return a ? a instanceof ArrayBuffer ? new Uint8Array(a.slice(c, c + o)) : new Uint8Array(await a.slice(c, c + o).arrayBuffer()) : null;
      } catch {
        return t.delete(r + u + s), null;
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
var V = "nodepod-package-packs-v1", b = 1;
async function F(e, t, n) {
  const i = await (await e.getFileHandle(t, { create: !0 })).createWritable();
  try {
    await i.write(n);
  } finally {
    await i.close();
  }
}
function B(e, t) {
  return t.dataFile ?? `${encodeURIComponent(e)}.bin`;
}
async function _() {
  const e = typeof navigator < "u" ? navigator.storage : null;
  if (!e?.getDirectory) return null;
  try {
    const t = await (await e.getDirectory()).getDirectoryHandle(V, { create: !0 }), n = async (s) => {
      try {
        const c = await t.getFileHandle(`${encodeURIComponent(s)}.json`), o = JSON.parse(await (await c.getFile()).text());
        return o?.schema !== b || !Array.isArray(o.manifest) ? null : o;
      } catch {
        return null;
      }
    }, i = /* @__PURE__ */ new Map(), r = async (s) => {
      const c = i.get(s);
      if (c) return c;
      const o = await (await t.getFileHandle(s)).getFile();
      return i.set(s, o), o;
    };
    return {
      async get(s) {
        const c = await n(s);
        if (!c) return null;
        try {
          const o = await (await (await t.getFileHandle(B(s, c))).getFile()).arrayBuffer();
          return o.byteLength !== c.byteLength ? null : {
            manifest: c.manifest,
            data: o
          };
        } catch {
          return null;
        }
      },
      async set(s, c) {
        const o = encodeURIComponent(s), a = await n(s), d = `${o}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.bin`;
        try {
          await F(t, d, c.data), await F(t, `${o}.json`, JSON.stringify({
            schema: b,
            createdAt: Date.now(),
            byteLength: c.data.byteLength,
            manifest: c.manifest,
            dataFile: d
          })), a && await t.removeEntry(B(s, a)).catch(() => {
          });
        } catch {
        }
      },
      async getManifest(s) {
        const c = await n(s);
        return c ? {
          manifest: c.manifest,
          version: B(s, c)
        } : null;
      },
      async readRange(s, c, o, a) {
        try {
          const d = await r(c);
          return o + a > d.size ? null : new Uint8Array(await d.slice(o, o + a).arrayBuffer());
        } catch {
          return i.delete(c), null;
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
function g(e, t) {
  const n = e;
  return t && (n.__nodepodRevokeUrl = t), n;
}
function w() {
  let e = null, t = null, n = null;
  function i() {
    if (n) return n;
    const r = atob(M), s = new Uint8Array(r.length);
    for (let a = 0; a < r.length; a++) s[a] = r.charCodeAt(a);
    const c = P(s, { to: "string" }), o = new Blob([c], { type: "application/javascript" });
    return n = URL.createObjectURL(o), n;
  }
  return {
    kind: "browser",
    canCreateWorkers() {
      return typeof Worker < "u" && typeof Blob < "u" && typeof URL < "u" && typeof URL.createObjectURL == "function";
    },
    createWorker(r) {
      if (typeof Worker > "u") throw new Error("[Nodepod] Web Workers are required.");
      if (r.type === "url") {
        const c = g(new Worker(r.url, { name: r.name }));
        return c.__nodepodDirect = !0, c;
      }
      if (r.type === "source") {
        const c = URL.createObjectURL(new Blob([r.source], { type: "application/javascript" }));
        return g(new Worker(c, { name: r.name }), c);
      }
      if (!r.embedded && e) try {
        const c = g(new Worker(e, { name: r.name }));
        return c.__nodepodDirect = !0, c;
      } catch {
        e = null;
      }
      const s = i();
      return g(new Worker(s, { name: r.name }));
    },
    async probeProcessWorkerUrl(r) {
      return t || (t = (async () => {
        if (typeof fetch > "u") return null;
        let s = r ?? null;
        if (!s) {
          try {
            s = new URL("./__worker__.js", "" + import.meta.url).href;
          } catch {
            return null;
          }
          if (!/^https?:/.test(s)) return null;
        }
        try {
          const c = await fetch(s, { method: "HEAD" });
          if (!c.ok) return null;
          const o = c.headers.get("content-type") || "";
          return o && !/javascript|ecmascript/i.test(o) ? null : (e = s, s);
        } catch {
          return null;
        }
      })(), t);
    },
    revokeObjectUrl(r) {
      try {
        URL.revokeObjectURL(r);
      } catch {
      }
      r === n && (n = null);
    },
    disposeGlobalResources() {
      if (n) {
        try {
          URL.revokeObjectURL(n);
        } catch {
        }
        n = null;
      }
      e = null, t = null;
    },
    async openSnapshotCache(r) {
      if (r.enableSnapshotCache === !1 || r.packageStore === "memory") return null;
      try {
        if (r.packageStore === "opfs") {
          const s = await _();
          if (s) return s;
        }
        return await E();
      } catch {
        return null;
      }
    },
    async openWorkspaceStore(r) {
      return W(r);
    },
    createHttpIngress() {
      return {
        kind: "programmatic",
        baseUrl: null
      };
    }
  };
}
globalThis.__NODEPOD_CREATE_BROWSER_HOST__ = w;
j(w);
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
    this.vol = e, this.cfg = t, this.thread = $(), this.endpoint = z(this.thread), this.ready = this.bootstrap(), this.attachVolumeSync();
  }
  async bootstrap() {
    const e = this.vol.toSnapshot(), t = {
      cwd: this.cfg.cwd,
      env: this.cfg.env
    };
    await this.endpoint.init(e, t), this.cfg.onConsole && await this.endpoint.setConsoleForwarder(Y(this.cfg.onConsole));
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
  constructor(e, t, n = {}) {
    this.targetOrigin = new URL(e).origin, this.vol = t, this.cfg = n, this.frame = document.createElement("iframe"), this.frame.src = e, this.frame.style.display = "none", this.frame.credentialless = !0, this.frame.setAttribute("credentialless", ""), this.frame.setAttribute("sandbox", "allow-scripts"), document.body.appendChild(this.frame), this.bindMessageHandler(), this.ready = this.awaitReady().then(() => this.sendInit()), this.attachVolumeSync();
  }
  bindMessageHandler() {
    this.onMessage = (e) => {
      if (e.origin !== "null" && e.origin !== this.targetOrigin) return;
      const t = e.data;
      if (t.type === "result" && t.id) {
        const n = this.pendingCalls.get(t.id);
        n && t.result && (n.resolve(t.result), this.pendingCalls.delete(t.id));
      } else if (t.type === "error" && t.id) {
        const n = this.pendingCalls.get(t.id);
        n && (n.reject(new Error(t.error || "Sandbox error")), this.pendingCalls.delete(t.id));
      } else t.type === "console" && this.cfg.onConsole && this.cfg.onConsole(t.consoleMethod || "log", t.consoleArgs || []);
    }, window.addEventListener("message", this.onMessage);
  }
  awaitReady() {
    return new Promise((e) => {
      const t = (n) => {
        n.origin !== "null" && n.origin !== this.targetOrigin || n.data.type === "ready" && (window.removeEventListener("message", t), e());
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
      const n = typeof SharedArrayBuffer < "u" && t.buffer instanceof SharedArrayBuffer ? new Uint8Array(t) : t;
      this.frame.contentWindow?.postMessage({
        type: "syncFile",
        path: e,
        content: n
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
    return new Promise((t, n) => {
      const i = String(this.nextId++);
      this.pendingCalls.set(i, {
        resolve: t,
        reject: n
      }), this.frame.contentWindow?.postMessage({
        ...e,
        id: i
      }, "*"), setTimeout(() => {
        this.pendingCalls.has(i) && (this.pendingCalls.delete(i), n(/* @__PURE__ */ new Error("Sandbox execution timeout")));
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
function h() {
  return typeof Worker < "u";
}
var ne = class {
  engine;
  constructor(e, t = {}) {
    this.engine = new v(e, t);
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
async function Ht(e, t = {}) {
  const { sandboxUrl: n, allowUnsafeEval: i, useWorker: r = !1, ...s } = t;
  if (n) {
    const o = new te(n, e, s);
    return await o.execute("/* sandbox ready check */", "/__sandbox_init__.js"), o;
  }
  if (!i) throw new Error(`nodepod: For security, you must either:
  1. Use sandbox mode: { sandboxUrl: "https://your-sandbox.example.com" }
  2. Explicitly opt-in to same-origin: { allowUnsafeEval: true }

Same-origin execution allows code to access cookies, localStorage, and IndexedDB.
Only use allowUnsafeEval for trusted code or demos.`);
  let c = !1;
  if ((r === !0 || r === "auto") && (c = h()), c) {
    const o = new ee(e, s);
    return await o.execute("/* worker ready check */", "/__worker_init__.js"), o;
  }
  return new ne(e, s);
}
var se = class {
  _vol;
  _processManager;
  _vfsBridge;
  _cfg;
  constructor(e, t = {}) {
    this._vol = e, this._cfg = t, this._processManager = new m(e), this._vfsBridge = new p(e), this._processManager.setVFSBridge(this._vfsBridge), this._vfsBridge.setBroadcaster((n, i, r, s) => {
      this._processManager.broadcastVFSChange(n, i, r, s);
    });
  }
  async execute(e, t) {
    const n = t ?? "/__exec_tmp__.js";
    return this._vol.writeFileSync(n, e), await this._runInWorker(n);
  }
  async runFile(e) {
    return this._runInWorker(e);
  }
  async _runInWorker(e) {
    return new Promise((t) => {
      const n = this._processManager.spawn({
        command: "node",
        args: [e],
        cwd: this._cfg.cwd ?? "/",
        env: this._cfg.env ?? {}
      });
      let i = "", r = "";
      n.on("stdout", (s) => {
        i += s;
      }), n.on("stderr", (s) => {
        r += s;
      }), n.on("ready", () => {
        n.exec({
          type: "exec",
          filePath: e,
          args: [],
          cwd: this._cfg.cwd,
          env: this._cfg.env
        });
      }), n.on("exit", (s) => {
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
async function Xt(e, t = {}) {
  return new se(e, t);
}
function re() {
  try {
    const e = globalThis.require;
    if (typeof e != "function") return null;
    const t = e("fs"), n = e("path");
    let i;
    try {
      const s = e("url");
      i = n.dirname(s.fileURLToPath(import.meta.url));
    } catch {
      i = typeof __dirname < "u" ? __dirname : ".";
    }
    let r = n.join(i, "__sw__.js");
    return t.existsSync(r) || (r = n.join(i, "../dist/__sw__.js"), t.existsSync(r)) ? t.readFileSync(r, "utf-8") : null;
  } catch {
    return null;
  }
}
function ie(e = {}) {
  const t = typeof e == "string" ? { nodepodUrl: e } : e, n = t.nodepodUrl ?? "https://unpkg.com/@r1ck404/nodepod/dist/index.js", i = t.enableServiceWorker ?? !0, r = t.parentOrigin ? JSON.stringify(t.parentOrigin) : "'*'";
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Nodepod Sandbox</title></head>
<body>
<script type="module">
  import { MemoryVolume, ScriptEngine } from '${n}';
${i ? `
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/__sw__.js', { scope: '/' })
      .then(() => console.log('[Sandbox] SW registered'))
      .catch(e => console.warn('[Sandbox] SW failed:', e));
  }
` : ""}
  const PARENT_ORIGIN = ${r};
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
function ce() {
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
function Dt(e = {}) {
  const t = typeof e == "string" ? { nodepodUrl: e } : e, n = t.enableServiceWorker ?? !0 ? re() : null, i = {
    "index.html": ie(t),
    "vercel.json": JSON.stringify(ce(), null, 2)
  };
  return n && (i["__sw__.js"] = n), i;
}
var Pt = `
# Deploying a Nodepod Sandbox

## 1. Generate sandbox files
   Use generateSandboxDeployment() to create the required files.

## 2. Deploy to a hosting provider
   cd sandbox && vercel --prod

## 3. Use in your app
   const engine = await spawnEngine(volume, {
     sandboxUrl: 'https://your-sandbox.example.com'
   });
`.trim(), Ot = class {
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
    for (const n of e.manifest) n.isDirectory ? this._dirs.add(n.path) : (this._files.set(n.path, t.slice(n.offset, n.offset + n.length)), this._ensureParentDirs(n.path));
  }
  setWriteCallback(e) {
    this._onWrite = e;
  }
  setDeleteCallback(e) {
    this._onDelete = e;
  }
  readFileSync(e, t) {
    const n = this._files.get(e);
    if (!n) {
      const i = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, open '${e}'`);
      throw i.code = "ENOENT", i.errno = -2, i;
    }
    if (t === "utf8" || t === "utf-8") {
      if (typeof SharedArrayBuffer < "u" && n.buffer instanceof SharedArrayBuffer) {
        const i = new Uint8Array(n.byteLength);
        return i.set(n), this._decoder.decode(i);
      }
      return this._decoder.decode(n);
    }
    return new Uint8Array(n);
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
    const n = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, stat '${e}'`);
    throw n.code = "ENOENT", n.errno = -2, n;
  }
  readdirSync(e) {
    if (!this._dirs.has(e)) {
      const i = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, scandir '${e}'`);
      throw i.code = "ENOENT", i.errno = -2, i;
    }
    const t = e === "/" ? "/" : e + "/", n = /* @__PURE__ */ new Set();
    for (const i of this._files.keys()) if (i.startsWith(t)) {
      const r = i.slice(t.length), s = r.indexOf("/");
      n.add(s === -1 ? r : r.slice(0, s));
    }
    for (const i of this._dirs) if (i.startsWith(t) && i !== e) {
      const r = i.slice(t.length), s = r.indexOf("/");
      n.add(s === -1 ? r : r.slice(0, s));
    }
    return Array.from(n).filter(Boolean).sort();
  }
  writeFileSync(e, t) {
    const n = typeof t == "string" ? this._encoder.encode(t) : new Uint8Array(t);
    this._files.set(e, n), this._ensureParentDirs(e), this._onWrite && this._onWrite(e, n, !1);
  }
  mkdirSync(e, t) {
    if (!this._dirs.has(e))
      if (t?.recursive) {
        const n = e.split("/").filter(Boolean);
        let i = "";
        for (const r of n)
          i += "/" + r, this._dirs.has(i) || (this._dirs.add(i), this._onWrite && this._onWrite(i, /* @__PURE__ */ new Uint8Array(0), !0));
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
    const n = this._files.get(e);
    n ? (this._files.delete(e), this._files.set(t, n), this._onDelete && this._onDelete(e), this._onWrite && this._onWrite(t, n, !1)) : this._dirs.has(e) && (this._dirs.delete(e), this._dirs.add(t), this._onDelete && this._onDelete(e), this._onWrite && this._onWrite(t, /* @__PURE__ */ new Uint8Array(0), !0));
  }
  appendFileSync(e, t) {
    const n = this._files.get(e) ?? /* @__PURE__ */ new Uint8Array(0), i = typeof t == "string" ? this._encoder.encode(t) : new Uint8Array(t), r = new Uint8Array(n.byteLength + i.byteLength);
    r.set(n, 0), r.set(i, n.byteLength), this._files.set(e, r), this._ensureParentDirs(e), this._onWrite && this._onWrite(e, r, !1);
  }
  copyFileSync(e, t) {
    const n = this._files.get(e);
    if (!n) {
      const r = /* @__PURE__ */ new Error(`ENOENT: no such file or directory, copyfile '${e}'`);
      throw r.code = "ENOENT", r.errno = -2, r;
    }
    const i = new Uint8Array(n);
    this._files.set(t, i), this._ensureParentDirs(t), this._onWrite && this._onWrite(t, i, !1);
  }
  applySync(e, t, n) {
    t === null ? (this._files.delete(e), this._dirs.delete(e)) : n ? this._dirs.add(e) : (this._files.set(e, new Uint8Array(t)), this._ensureParentDirs(e));
  }
  _ensureParentDirs(e) {
    const t = e.split("/").filter(Boolean);
    let n = "";
    for (let i = 0; i < t.length - 1; i++)
      n += "/" + t[i], this._dirs.add(n);
  }
  get fileCount() {
    return this._files.size;
  }
  get dirCount() {
    return this._dirs.size;
  }
};
j(w);
globalThis.__NODEPOD_CREATE_BROWSER_HOST__ = w;
var x = null;
async function C() {
  return x || (x = await import("./child_process-C18i9xSb.js")), x;
}
function It(e) {
  const t = new U(), n = new v(t, e), i = new O(t, { cwd: e?.cwd }), r = I({
    baseUrl: e?.baseUrl,
    onServerReady: e?.onServerReady
  });
  return C().then((s) => s.initShellExec(t, { cwd: e?.cwd })), {
    volume: t,
    engine: n,
    packages: i,
    proxy: r,
    execute: (s, c) => n.execute(s, c),
    runFile: (s) => n.runFile(s),
    run: async (s, c) => {
      if (c?.signal?.aborted) return {
        stdout: "",
        stderr: "",
        exitCode: 130
      };
      const o = await C(), a = c?.onStdout || c?.onStderr || c?.signal;
      return a && o.setStreamingCallbacks({
        onStdout: c?.onStdout,
        onStderr: c?.onStderr,
        signal: c?.signal
      }), new Promise((d) => {
        o.exec(s, { cwd: c?.cwd }, (l, H, X) => {
          a && o.clearStreamingCallbacks(), d({
            stdout: String(H),
            stderr: String(X),
            exitCode: l ? l.code ?? 1 : 0
          });
        });
      });
    },
    sendInput: async (s) => {
      (await C()).sendStdin(s);
    },
    createREPL: () => n.createREPL(),
    on: (s, c) => {
      r.on(s, c);
    }
  };
}
export {
  O as DependencyInstaller,
  te as IframeSandbox,
  Ne as LRUCache,
  Te as MemoryHandler,
  U as MemoryVolume,
  qe as Nodepod,
  Xe as NodepodFS,
  me as NodepodFSClient,
  We as NodepodFSClientError,
  Ve as NodepodProcess,
  Ge as NodepodSWSetupError,
  ge as NodepodTerminal,
  Me as PreviewAgentUnavailableError,
  Ie as PreviewInspectionTimeoutError,
  Ke as PreviewInspector,
  Ze as PreviewInspectorError,
  pe as PreviewNotAttachedError,
  Re as PreviewScreenshotUnavailableError,
  xe as ProcessHandle,
  m as ProcessManager,
  se as ProcessWorkerAdapter,
  Be as RequestProxy,
  Pt as SANDBOX_DEPLOYMENT_GUIDE,
  v as ScriptEngine,
  _e as SharedVFSController,
  Ae as SharedVFSReader,
  ye as SyncChannelController,
  Ee as SyncChannelWorker,
  p as VFSBridge,
  ee as WorkerSandbox,
  Ot as WorkerVFS,
  Se as WorkspacePersistence,
  dt as assert,
  He as buildFileSystemBridge,
  Ft as buildProcessEnv,
  gt as chokidar,
  w as createBrowserHost,
  W as createIndexedDBWorkspaceStore,
  ke as createMemoryWorkspaceStore,
  de as createProcessContext,
  It as createWorkspace,
  It as default,
  Je as deleteIndexedDBWorkspace,
  he as discoverWorkspaces,
  st as ensureRuntimeHost,
  Pe as esbuild,
  Oe as events,
  xt as executeCode,
  Ct as fsevents,
  Dt as generateSandboxDeployment,
  fe as getActiveContext,
  vt as getCorsProxy,
  I as getProxyInstance,
  et as getRuntimeHost,
  ce as getSandboxHostingConfig,
  ie as getSandboxPageHtml,
  we as http,
  Ye as install,
  ze as installFetchHeadersSetCookieParity,
  Fe as installNodeFetchClassParity,
  De as isSharedArrayBufferAvailable,
  Ue as listIndexedDBWorkspaces,
  lt as module,
  Le as net,
  be as npm,
  it as path,
  yt as perf_hooks,
  bt as querystring,
  ve as readWorkspacePatterns,
  At as readdirp,
  je as resetProxy,
  nt as resetRuntimeHost,
  ut as rollup,
  ae as setActiveContext,
  Qt as setAllowedDomains,
  jt as setCorsProxy,
  Qe as setFetchResponse,
  tt as setRuntimeHost,
  Ht as spawnEngine,
  Xt as spawnProcessWorkerEngine,
  Ce as stream,
  Et as t,
  ft as url,
  Lt as util,
  wt as worker_threads,
  Bt as ws
};

//# sourceMappingURL=index.mjs.map