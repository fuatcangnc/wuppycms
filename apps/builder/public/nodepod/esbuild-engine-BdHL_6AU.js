import { f as M, i as S, n as p, r as W } from "./cdn-urls-BV1eSMdl.js";
var C = 524288;
function f() {
  const e = globalThis;
  return e.__nodepodEsbuildState ??= {
    generation: 0,
    primary: null
  };
}
function y(e, n) {
  const r = globalThis, i = r.Worker;
  let t = null;
  if (typeof i == "function") {
    const s = function(...u) {
      const o = new i(...u);
      return t = o, o;
    };
    s.prototype = i.prototype, r.Worker = s;
  }
  let l;
  try {
    l = e.initialize({
      ...n,
      serviceInWorker: !0,
      smallInput: -1
    });
  } finally {
    i && (r.Worker = i);
  }
  return {
    ready: l,
    worker: () => t
  };
}
var T = null;
function x() {
  return (async () => {
  })().constructor;
}
async function h(e) {
  try {
    const n = await (T ??= fetch(W).then((i) => {
      if (!i.ok) throw new Error(`HTTP ${i.status}`);
      return i.text();
    })), r = { exports: {} };
    if (new Function("module", "Promise", `${n}
//# sourceURL=esbuild-wasm-${e}.js`)(r, x()), typeof r.exports.initialize == "function") return r.exports;
    throw new Error("unexpected esbuild-wasm browser build");
  } catch {
    T = null, w++;
    const n = await M(`${S}?${e}`);
    return n.default || n;
  }
}
function R(e) {
  const n = globalThis, r = f();
  if (n.__nodepodEsbuild) return n.__nodepodEsbuild;
  if (e?.wasmURL && e.wasmURL !== p && r.generation === 0 && !r.primary && (r.customWasmURL = e.wasmURL), n.__esbuild)
    return n.__nodepodEsbuildReady = n.__esbuild, n.__nodepodEsbuild = Promise.resolve(n.__esbuild), n.__nodepodEsbuild;
  const i = r.generation;
  return n.__nodepodEsbuild = (async () => {
    try {
      const t = r.customWasmURL, [l, s] = await Promise.all([h(`nodepod-instance=${r.generation}`), t ? null : b()]), u = {
        engine: l,
        worker: null,
        pending: 0,
        detached: !1,
        js: !0
      };
      let o = null;
      try {
        o = y(l, s ? { wasmModule: s } : { wasmURL: t || p }), await o.ready, u.worker = o.worker();
      } catch (a) {
        if (!(a instanceof Error && a.message.includes('Cannot call "initialize" more than once'))) {
          try {
            o?.worker()?.terminate();
          } catch {
          }
          throw a;
        }
      }
      if (r.generation !== i)
        throw c(u), new Error("esbuild: stopped while initializing");
      return r.primary = u, n.__nodepodEsbuildReady = l, l;
    } catch (t) {
      throw r.generation === i && (n.__nodepodEsbuild = void 0), new Error(`esbuild: initialization failed -- ${t}`);
    }
  })(), n.__nodepodEsbuild;
}
var g = 24, w = 0;
async function b() {
  const e = globalThis.__nodepodRequestEsbuildModule;
  try {
    if (e) return await e();
    if (typeof document < "u") {
      const { getSharedEsbuildModule: n } = await import("./esbuild-wasm-module-BwIvgLFG.js").then((r) => r.t);
      return await n();
    }
  } catch {
  }
  return null;
}
function L() {
  return globalThis.__nodepodEsbuildReady ?? null;
}
function m(e, n, r = !1) {
  e && (e.pending++, r && (e.builds = (e.builds ?? 0) + 1));
  let i = !1;
  return {
    engine: n,
    release(t = 0) {
      i || !e || (i = !0, e.pending--, r && e.builds--, t >= C && !e.js && k(e), e.detached && e.pending === 0 && c(e));
    }
  };
}
async function v(e) {
  const n = globalThis;
  for (let r = 0; r < 8; r++) {
    const i = L() ?? await R(e), t = f().primary;
    if (t && t.engine === i) return m(t, i, e?.build);
    if (!t && i === n.__esbuild) return m(null, i);
    L() === i && (n.__nodepodEsbuildReady = void 0, n.__nodepodEsbuild = void 0);
  }
  throw new Error("esbuild: no instance available");
}
function k(e) {
  if (e.detached || !e.worker && !e.js) return;
  const n = f();
  if (n.primary === e && w >= g) return;
  if (e.detached = !0, n.primary === e) {
    const i = globalThis;
    n.primary = null, n.generation++, i.__nodepodEsbuildReady = void 0, i.__nodepodEsbuild = void 0, R().catch(() => {
    });
    return;
  }
  const r = d.findIndex((i) => i.instance === e);
  if (r >= 0) {
    const [i] = d.splice(r, 1);
    i.idleTimer && clearTimeout(i.idleTimer);
  }
}
function c(e) {
  try {
    e.worker?.terminate(), e.js && e.engine.stop?.();
  } catch {
  }
  e.worker = null;
}
var D = 0, _ = 3, j = 3e3, d = [], U = 0;
function A() {
  const e = {
    instance: null,
    idleTimer: null
  };
  d.push(e), (async () => {
    let n = null;
    try {
      const [r, i] = await Promise.all([h(`nodepod-lane=${++U}`), b()]);
      n = y(r, i ? { wasmModule: i } : { wasmURL: p }), await n.ready;
      const t = {
        engine: r,
        worker: n.worker(),
        pending: 0,
        detached: !1,
        js: !0
      };
      if (!d.includes(e) || !t.worker && !t.js)
        throw c(t), new Error("lane dropped");
      e.instance = t, I(e);
    } catch {
      if (!e.instance) try {
        n?.worker()?.terminate();
      } catch {
      }
      const r = d.indexOf(e);
      r >= 0 && d.splice(r, 1);
    }
  })();
}
async function P() {
  if (f().customWasmURL || typeof Worker != "function" || w >= g) return null;
  let e = null;
  try {
    const [n, r] = await Promise.all([h(`nodepod-dedicated=${++U}`), b()]);
    e = y(n, r ? { wasmModule: r } : { wasmURL: p }), await e.ready;
    const i = {
      engine: n,
      worker: e.worker(),
      pending: 0,
      detached: !0,
      js: !0
    };
    return !i.worker && !i.js ? (c(i), null) : m(i, n, !0);
  } catch {
    try {
      e?.worker()?.terminate();
    } catch {
    }
    return null;
  }
}
function I(e) {
  e.idleTimer && clearTimeout(e.idleTimer);
  const n = setTimeout(() => {
    e.idleTimer = null;
    const r = e.instance;
    r && r.pending === 0 && (k(r), c(r));
  }, j);
  n.unref?.(), e.idleTimer = n;
}
async function $(e, n = 0) {
  const r = f(), i = r.primary, t = i ? i.pending + (i.builds ? _ : 0) : 1 / 0;
  let l = t, s = null;
  for (const o of d) {
    const a = o.instance;
    a && !a.detached && a.pending < l && (s = o, l = a.pending);
  }
  if (!s && i && t >= _ && d.length < D && w < g && d.every((o) => o.instance && o.instance.pending >= _) && !r.customWasmURL && typeof Worker == "function" && A(), s?.instance) {
    const o = s, a = s.instance;
    o.idleTimer && (clearTimeout(o.idleTimer), o.idleTimer = null);
    const E = m(a, a.engine);
    try {
      return await e(E.engine);
    } finally {
      E.release(n), !a.detached && a.pending === 0 && I(o);
    }
  }
  const u = await v();
  try {
    return await e(u.engine);
  } finally {
    u.release(n);
  }
}
function z() {
  globalThis.__nodepodEsbuild || v().then(async (e) => {
    try {
      const n = e.engine;
      await n.transform("export const a: number = 1", { loader: "ts" }), await n.build({
        stdin: {
          contents: "import { a } from './a'; export default a",
          loader: "ts",
          resolveDir: "/"
        },
        plugins: [{
          name: "nodepod-prewarm",
          setup(r) {
            r.onResolve({ filter: /.*/ }, (i) => ({
              path: i.path,
              namespace: "prewarm"
            })), r.onLoad({
              filter: /.*/,
              namespace: "prewarm"
            }, () => ({
              contents: "export const a = 1",
              loader: "js"
            }));
          }
        }],
        bundle: !0,
        write: !1,
        format: "esm",
        logLevel: "silent"
      });
    } finally {
      e.release();
    }
  }).catch(() => {
  });
}
function B() {
  const e = globalThis, n = f();
  for (const i of d.splice(0))
    i.idleTimer && clearTimeout(i.idleTimer), i.instance && c(i.instance);
  try {
    e.__nodepodEsbuildReady?.stop?.();
  } catch {
  }
  const r = n.primary;
  r && !(e.__esbuild && r.engine === e.__esbuild) && (r.detached = !0, c(r)), n.primary = null, n.generation++, e.__nodepodEsbuildReady = void 0, e.__nodepodEsbuild = void 0;
}
export {
  L as a,
  R as i,
  v as n,
  z as o,
  B as r,
  $ as s,
  P as t
};

//# sourceMappingURL=esbuild-engine-BdHL_6AU.js.map