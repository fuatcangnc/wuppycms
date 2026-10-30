var p = Object.create, i = Object.defineProperty, y = Object.getOwnPropertyDescriptor, b = Object.getOwnPropertyNames, C = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, R = (e, t, r) => () => {
  if (r) throw r[0];
  try {
    return e && (t = e(e = 0)), t;
  } catch (s) {
    throw r = [s], s;
  }
}, S = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), j = (e, t) => {
  let r = {};
  for (var s in e)
    i(r, s, {
      get: e[s],
      enumerable: !0
    });
  return t || i(r, Symbol.toStringTag, { value: "Module" }), r;
}, c = (e, t, r, s) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (var l = b(t), o = 0, _ = l.length, n; o < _; o++)
      n = l[o], !a.call(e, n) && n !== r && i(e, n, {
        get: ((v) => t[v]).bind(null, n),
        enumerable: !(s = y(t, n)) || s.enumerable
      });
  return e;
}, A = (e, t, r) => (r = e != null ? p(C(e)) : {}, c(t || !e || !e.__esModule || !a.call(e, "default") ? i(r, "default", {
  value: e,
  enumerable: !0
}) : r, e)), M = (e) => a.call(e, "module.exports") ? e["module.exports"] : c(i({}, "__esModule", { value: !0 }), e), x = 100;
function D(e) {
  return {
    pid: e.pid ?? x++,
    cwd: e.cwd ?? "/",
    env: e.env ?? {},
    stdoutSink: null,
    stderrSink: null,
    liveStdin: null,
    abortController: new AbortController(),
    volume: e.volume,
    handles: E(),
    termCols: null,
    termRows: null,
    fdCounter: 3,
    openFiles: /* @__PURE__ */ new Map()
  };
}
var f = null;
function g() {
  return f;
}
function N(e) {
  f = e;
}
var d = /* @__PURE__ */ Symbol.for("nodepod.ProcessExitSentinel"), B = class extends Error {
  exitCode;
  [d] = !0;
  constructor(e) {
    super(`Process exited with code ${e}`), this.name = "ProcessExitSentinel", this.exitCode = e;
  }
};
function P(e) {
  if (!e || typeof e != "object") return !1;
  try {
    return Object.getOwnPropertyDescriptor(e, d)?.value === !0;
  } catch {
    return !1;
  }
}
var w = class {
  type;
  registry;
  refed;
  closed = !1;
  constructor(e, t, r) {
    this.registry = e, this.type = t, this.refed = r;
  }
  ref() {
    return this.closed || this.refed ? this : (this.refed = !0, this.registry._incRefed(), this);
  }
  unref() {
    return this.closed || !this.refed ? this : (this.refed = !1, this.registry._decRefed(), this);
  }
  close() {
    this.closed || (this.closed = !0, this.refed && (this.refed = !1, this.registry._decRefed()), this.registry._remove(this));
  }
}, h = class {
  _handles = /* @__PURE__ */ new Set();
  _refedCount = 0;
  _drainCbs = /* @__PURE__ */ new Set();
  _beforeExitCbs = [];
  _drainPromise = null;
  _drainResolve = null;
  register(e, t) {
    const r = t?.refed !== !1, s = new w(this, e, r);
    return this._handles.add(s), r && this._refedCount++, s;
  }
  activeRefedCount() {
    return this._refedCount;
  }
  list() {
    return Array.from(this._handles);
  }
  groupedByType() {
    const e = {};
    for (const t of this._handles)
      t.refed && (e[t.type] = (e[t.type] ?? 0) + 1);
    return e;
  }
  drainPromise() {
    return this._refedCount === 0 ? Promise.resolve() : this._drainPromise ? this._drainPromise : (this._drainPromise = new Promise((e) => {
      this._drainResolve = e;
    }), this._drainPromise);
  }
  onDrain(e) {
    return this._drainCbs.add(e), () => this._drainCbs.delete(e);
  }
  async emitBeforeExit(e) {
    const t = this._beforeExitCbs.slice();
    for (const r of t) try {
      await r(e);
    } catch (s) {
      if (P(s)) throw s;
    }
  }
  onBeforeExit(e) {
    return this._beforeExitCbs.push(e), () => {
      const t = this._beforeExitCbs.indexOf(e);
      t >= 0 && this._beforeExitCbs.splice(t, 1);
    };
  }
  closeAll() {
    for (const e of Array.from(this._handles)) e.close();
  }
  _incRefed() {
    this._refedCount++;
  }
  _decRefed() {
    if (this._refedCount > 0 && this._refedCount--, this._refedCount === 0) {
      const e = this._drainResolve;
      this._drainPromise = null, this._drainResolve = null, e && e();
      for (const t of this._drainCbs) try {
        t();
      } catch {
      }
    }
  }
  _remove(e) {
    this._handles.delete(e);
  }
}, m = new h();
function O() {
  return g()?.handles ?? m;
}
function E() {
  return new h();
}
async function I(e, t) {
  const r = O().register(e);
  try {
    return await t();
  } finally {
    r.close();
  }
}
var u = 0;
function T(e) {
  u++;
  try {
    return e();
  } finally {
    u--;
  }
}
export {
  I as a,
  N as c,
  j as d,
  M as f,
  T as i,
  S as l,
  O as n,
  D as o,
  A as p,
  P as r,
  g as s,
  B as t,
  R as u
};

//# sourceMappingURL=event-loop-CGuYUIBq.js.map