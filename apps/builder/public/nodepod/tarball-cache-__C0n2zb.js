import { d as oe, i as ie } from "./event-loop-CGuYUIBq.js";
var at = 32768, wt = Uint8Array.prototype.toBase64, Lt = Uint8Array.fromBase64;
function Kt(t) {
  if (t.length <= at) return String.fromCharCode.apply(null, t);
  const e = [];
  for (let n = 0; n < t.length; n += at) e.push(String.fromCharCode.apply(null, t.subarray(n, n + at)));
  return e.join("");
}
function gn(t) {
  if (wt) try {
    return wt.call(t);
  } catch {
  }
  return btoa(Kt(t));
}
function mn(t) {
  if (Lt) try {
    return Lt(t);
  } catch {
  }
  const e = atob(t), n = new Uint8Array(e.length);
  for (let r = 0; r < e.length; r++) n[r] = e.charCodeAt(r);
  return n;
}
var Ct = new Array(256);
for (let t = 0; t < 256; t++) Ct[t] = (t < 16 ? "0" : "") + t.toString(16);
function An(t) {
  const e = new Array(t.length);
  for (let n = 0; n < t.length; n++) e[n] = Ct[t[n]];
  return e.join("");
}
function wn(t) {
  return Kt(t);
}
var ce = 64, ae = String.fromCharCode;
function Ln(t) {
  const e = t.length;
  if (e > ce) return null;
  for (let n = 0; n < e; n++) if (t[n] > 127) return null;
  return ae.apply(null, t);
}
var vn = /* @__PURE__ */ oe({
  basename: () => T,
  default: () => fe,
  delimiter: () => ":",
  dirname: () => F,
  extname: () => V,
  format: () => et,
  isAbsolute: () => G,
  join: () => Y,
  normalize: () => K,
  parse: () => tt,
  posix: () => Ut,
  relative: () => Z,
  resolve: () => _,
  sep: () => "/",
  win32: () => _t
});
var ue = /\/\/|(?:^|\/)\.\.?(?:\/|$)|.\/$/;
function K(t) {
  if (!t) return ".";
  if (!ue.test(t)) return t;
  const e = t.charAt(0) === "/", n = t.split("/").filter((s) => s.length > 0), r = [];
  for (const s of n) s === ".." ? r.length > 0 && r[r.length - 1] !== ".." ? r.pop() : e || r.push("..") : s !== "." && r.push(s);
  let o = r.join("/");
  return e && (o = "/" + o), o || ".";
}
function Y(...t) {
  if (t.length === 0) return ".";
  let e = "", n = !0;
  for (let r = 0; r < t.length; r++) {
    const o = t[r];
    if (o !== "") {
      if (typeof o != "string") return K(t.filter((s) => s !== "").join("/"));
      e = n ? o : e + "/" + o, n = !1;
    }
  }
  return K(e);
}
var Dt = /^[a-z][a-z0-9+\-.]*:/i;
function le(t) {
  if (!Dt.test(t)) return t;
  try {
    const e = new globalThis.URL(t);
    if (e.protocol === "file:" || e.protocol === "http:" || e.protocol === "https:") return decodeURIComponent(e.pathname) || t;
  } catch {
  }
  return t;
}
function _(...t) {
  let e = "";
  for (let n = t.length - 1; n >= 0; n--) {
    const r = t[n];
    if (r && (e = le(r) + (e ? "/" + e : ""), e.charAt(0) === "/"))
      break;
  }
  return e.charAt(0) !== "/" && (e = (typeof globalThis < "u" && globalThis.process && typeof globalThis.process.cwd == "function" ? globalThis.process.cwd() : "/") + (e ? "/" + e : "")), K(e);
}
function G(t) {
  if (!t) return !1;
  if (t.charAt(0) === "/") return !0;
  if (Dt.test(t)) try {
    const e = new globalThis.URL(t);
    if (e.protocol === "file:" || e.protocol === "http:" || e.protocol === "https:") return !0;
  } catch {
  }
  return !1;
}
function F(t) {
  const e = t ? t.length : 0;
  if (e === 0) return ".";
  const n = t.charAt(0) === "/";
  let r = -1, o = !0;
  for (let s = e - 1; s >= 1; s--) if (t.charAt(s) === "/") {
    if (!o) {
      r = s;
      break;
    }
  } else o = !1;
  return r === -1 ? n ? "/" : "." : n && r === 0 ? "/" : t.substring(0, r);
}
function T(t, e) {
  const n = t ? t.length : 0;
  if (n === 0) return "";
  let r = n;
  for (; r > 0 && t.charAt(r - 1) === "/"; ) r--;
  if (r === 0) return "";
  let o = 0;
  for (let i = r - 1; i >= 0; i--) if (t.charAt(i) === "/") {
    o = i + 1;
    break;
  }
  let s = t.substring(o, r);
  return e && s.endsWith(e) && s.length > e.length && (s = s.substring(0, s.length - e.length)), s;
}
function V(t) {
  const e = T(t), n = e.lastIndexOf(".");
  return n <= 0 ? "" : e.substring(n);
}
function Z(t, e) {
  const n = _(t), r = _(e);
  if (n === r) return "";
  if (n === "/") return r.slice(1);
  if (r.startsWith(n) && r.charCodeAt(n.length) === 47) return r.slice(n.length + 1);
  const o = n.split("/").filter(Boolean), s = r.split("/").filter(Boolean);
  let i = 0;
  const c = Math.min(o.length, s.length);
  for (; i < c && o[i] === s[i]; ) i++;
  const a = o.length - i, u = s.slice(i), l = [];
  for (let f = 0; f < a; f++) l.push("..");
  return l.push(...u), l.join("/") || ".";
}
function tt(t) {
  const e = K(t), n = G(e), r = F(e), o = T(e), s = V(e), i = o.substring(0, o.length - s.length);
  return {
    root: n ? "/" : "",
    dir: r,
    base: o,
    ext: s,
    name: i
  };
}
function et(t) {
  const e = t.dir || t.root || "", n = t.base || (t.name || "") + (t.ext || "");
  return e ? e === t.root ? e + n : e + "/" + n : n;
}
var Ut = {
  sep: "/",
  delimiter: ":",
  normalize: K,
  join: Y,
  resolve: _,
  isAbsolute: G,
  dirname: F,
  basename: T,
  extname: V,
  relative: Z,
  parse: tt,
  format: et
}, _t = {
  sep: "\\",
  delimiter: ";",
  normalize: K,
  join: Y,
  resolve: _,
  isAbsolute: G,
  dirname: F,
  basename: T,
  extname: V,
  relative: Z,
  parse: tt,
  format: et
}, fe = {
  sep: "/",
  delimiter: ":",
  normalize: K,
  join: Y,
  resolve: _,
  isAbsolute: G,
  dirname: F,
  basename: T,
  extname: V,
  relative: Z,
  parse: tt,
  format: et,
  posix: Ut,
  win32: _t
}, he = 65536, jt = /* @__PURE__ */ new WeakMap();
function j(t, e) {
  jt.set(t, e);
}
function Ie(t) {
  return jt.get(t);
}
function w(t, e) {
  let n = 0, r = 1;
  for (let o = 0; o < 10; o++) {
    if (e.p >= t.length) throw new Error("truncated");
    const s = t[e.p++];
    if (n += (s & 127) * r, (s & 128) === 0) return n;
    r *= 128;
  }
  throw new Error("LEB128 too long");
}
function vt(t, e) {
  const n = t[e.p++];
  (n === 99 || n === 100) && w(t, e);
}
function W(t) {
  let e;
  if (t instanceof Uint8Array ? e = t : ArrayBuffer.isView(t) ? e = new Uint8Array(t.buffer, t.byteOffset, t.byteLength) : e = new Uint8Array(t), e.length < 8 || e[0] !== 0 || e[1] !== 97 || e[2] !== 115 || e[3] !== 109) return null;
  const n = { p: 8 }, r = [], o = new TextDecoder();
  try {
    for (; n.p < e.length; ) {
      const s = e[n.p++], i = w(e, n), c = n.p + i;
      if (c > e.length) return null;
      if (s === 2) {
        const a = w(e, n);
        for (let u = 0; u < a; u++) {
          const l = w(e, n), f = o.decode(e.subarray(n.p, n.p + l));
          n.p += l;
          const h = w(e, n), d = o.decode(e.subarray(n.p, n.p + h));
          n.p += h;
          const p = e[n.p++];
          if (p === 0) w(e, n);
          else if (p === 1) {
            vt(e, n);
            const y = e[n.p++];
            w(e, n), y & 1 && w(e, n);
          } else if (p === 2) {
            const y = w(e, n);
            if (y & -4) return null;
            const k = w(e, n);
            if (k > he) return null;
            y & 1 && w(e, n), r.push({
              module: f,
              name: d,
              minPages: k
            });
          } else if (p === 3)
            vt(e, n), n.p++;
          else if (p === 4)
            n.p++, w(e, n);
          else return null;
          if (n.p > c) return null;
        }
        return r;
      }
      if (s > 2 && s !== 0) return r;
      n.p = c;
    }
  } catch {
  }
  return r;
}
function de(t) {
  return t instanceof Uint8Array || ArrayBuffer.isView(t) && t.constructor.name === "Uint8Array";
}
function St(t) {
  if (!Number.isSafeInteger(t) || t < 0) throw new Error("positive integer expected, got " + t);
}
function C(t, ...e) {
  if (!de(t)) throw new Error("Uint8Array expected");
  if (e.length > 0 && !e.includes(t.length)) throw new Error("Uint8Array expected of length " + e + ", got length=" + t.length);
}
function pe(t) {
  if (typeof t != "function" || typeof t.create != "function") throw new Error("Hash should be wrapped by utils.createHasher");
  St(t.outputLen), St(t.blockLen);
}
function q(t, e = !0) {
  if (t.destroyed) throw new Error("Hash instance has been destroyed");
  if (e && t.finished) throw new Error("Hash#digest() has already been called");
}
function ye(t, e) {
  C(t);
  const n = e.outputLen;
  if (t.length < n) throw new Error("digestInto() expects output buffer of length at least " + n);
}
function x(...t) {
  for (let e = 0; e < t.length; e++) t[e].fill(0);
}
function ut(t) {
  return new DataView(t.buffer, t.byteOffset, t.byteLength);
}
var ke = typeof Uint8Array.from([]).toHex == "function" && typeof Uint8Array.fromHex == "function", be = /* @__PURE__ */ Array.from({ length: 256 }, (t, e) => e.toString(16).padStart(2, "0"));
function ge(t) {
  if (C(t), ke) return t.toHex();
  let e = "";
  for (let n = 0; n < t.length; n++) e += be[t[n]];
  return e;
}
function nt(t) {
  if (typeof t != "string") throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(t));
}
function Tt(t) {
  return typeof t == "string" && (t = nt(t)), C(t), t;
}
function Sn(t) {
  return typeof t == "string" && (t = nt(t)), C(t), t;
}
function Hn(t, e) {
  if (e !== void 0 && {}.toString.call(e) !== "[object Object]") throw new Error("options should be object or undefined");
  return Object.assign(t, e);
}
var xt = class {
}, Qt = /* @__PURE__ */ new Map(), X = 128, lt = 192, D = 384, z = 640, Ot = 64256, me = 64896, Ae, we = [];
function dt(t) {
  if (typeof WebAssembly != "object") throw new Error("fast-noble-hashes needs WebAssembly");
  const e = [], n = (r) => {
    const o = t.charCodeAt(r);
    return o - (o > 92 ? 34 : o > 34 ? 33 : 32);
  };
  for (let r = 0, o; r < t.length; ) e.push(((o = n(r++)) < 2 ? o * 93 + n(r++) + 85 : o - 8) & 255);
  return new Uint8Array(e);
}
function Le(t) {
  const e = /* @__PURE__ */ new Uint8Array(32768), n = dt(je), r = dt(t.t), o = t.r;
  let s = 0;
  const i = (a) => {
    for (; ; ) {
      const u = a & 127;
      if (a >>= 7, a == (u & 64 ? -1 : 0)) return e[s++] = u;
      e[s++] = u | 128;
    }
  }, c = (a, u, l, f) => {
    for (; u < l; ) {
      let h = a[u++];
      if (h < 255 || (h = a[u++]) == 255) e[s++] = h;
      else if (h < 16) e[s++] = 3 + (h - f % o + o) % o;
      else if (h < 32) e[s++] = 3 + o + (h - 16 + f & 15);
      else if (h == 33) i(a[u + 1] + a[u + 2] * 256 + a[u] * f), u += 3;
      else if (h == 35) i(t.c[a[u++]]);
      else if (h == 42) c(r, 0, r.length, 0);
      else if (h < 48) {
        const d = a[u++], p = h > 40 ? a[u++] : 0, y = a[u++] | a[u++] << 8;
        if (h < 43) for (let k = 0; k < d; k++) c(a, u, u + y, k);
        else f >= p && f < d && c(a, u, u + y, f);
        u += y;
      } else i(t.x(h, f));
    }
  };
  return c(n, 0, n.length, 0), e.subarray(0, s);
}
function rt(t, e, n, r, o, s) {
  const i = {
    t,
    b: e,
    c: [
      e,
      n + 1,
      D + e - 8,
      512 + e - 8
    ],
    r,
    k: o,
    x: s
  };
  return we.push(i), i;
}
function st(t) {
  if (!t.e) {
    const e = Le(t), n = new WebAssembly.Instance(new WebAssembly.Module(e)).exports, r = new Uint8Array(n.m.buffer);
    t.m = r, t.i = new Int32Array(n.m.buffer), t.v = r.subarray(D, D + t.b), t.o = r.subarray(z), t.k && new BigUint64Array(n.m.buffer, me).set(t.k()), t.e = n;
  }
  return t;
}
var Wt = (t) => () => {
  const e = [];
  for (let n = 2; e.length < t; n++) {
    let r = 2;
    for (; r * r <= n && n % r; ) r++;
    if (r * r > n) {
      const o = BigInt(n) << 192n;
      let s = BigInt(Math.floor(Math.cbrt(n) * 2 ** 40) + 2) << 24n;
      for (let i; (i = (2n * s + o / (s * s)) / 3n) < s; ) s = i;
      e.push(s);
    }
  }
  return e;
}, ve = (t, e) => t < 50 ? [
  7,
  12,
  17,
  22,
  5,
  9,
  14,
  20,
  4,
  11,
  16,
  23,
  6,
  10,
  15,
  21
][(e >> 4) * 4 + (e & 3)] : 4 * ([
  e,
  5 * e + 1,
  3 * e + 5,
  7 * e
][e >> 4] & 15);
function Se(t, e) {
  const n = e.i;
  e.b > 64 ? n.set(t.get()) : (n[0] = t.A, n[1] = t.B, n[2] = t.C, n[3] = t.D, n[4] = t.E, n[5] = t.F, n[6] = t.G, n[7] = t.H);
}
function zt(t, e) {
  t.set(e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]);
}
function pt(t) {
  const e = Qt.get(t.constructor);
  return e && t.blockLen === e.blockLen && t.outputLen === e.outputLen && t.padOffset === e.padOffset && t.isLE === e.isLE ? e : void 0;
}
function Rt(t, e) {
  if (typeof e == "string") {
    if (e.length * 3 <= Ot)
      return t.q = null, (Ae ||= new TextEncoder()).encodeInto(e, t.o).written;
    e = nt(e);
  }
  return t.q = e, e.length;
}
function Gt(t, e, n) {
  const r = t.q;
  if (!r) return t.e.u(e, n);
  for (let o = 0, s; o < n; o += s)
    s = Math.min(Ot - e, n - o), t.m.set(s < n ? r.subarray(o, o + s) : r, z), e = t.e.u(e, s);
  return e;
}
function Ht(t, e, n) {
  const { buffer: r, pos: o } = t;
  let s = 0;
  if (!n && typeof e != "string" && (C(e), o + e.length < t.blockLen))
    return r.set(e, o), t.pos += e.length, t.length += e.length, t.roundClean(), !0;
  const i = pt(t);
  if (!i || n && t.length !== t.length >>> 0) return !1;
  const c = st(i.f), a = c.m;
  if (!n && (s = Rt(c, e), o + s < c.b)) {
    for (let l = 0; l < s; l++) r[o + l] = a[z + l], a[z + l] = 0;
    return t.pos += s, t.length += s, !0;
  }
  Se(t, c);
  const u = !n && !o && !(s % c.b);
  return u || a.set(r, D), n ? c.e.d(o, t.length) : (t.pos = Gt(c, o, s), t.length += s), u || r.set(c.v), n && e.set(i.o ||= a.subarray(X, X + i.outputLen)), zt(t, c.i), c.e.z(), !0;
}
function ot(t, e, n, r) {
  st(r);
  const o = r.d ||= new DataView(r.m.buffer);
  try {
    for (let s = 0; s < r.b; s += 4, n += 4) o.setUint32(z + s, e.getUint32(n));
    r.i.set((r.g || t.get).call(t)), r.e.u(0, r.b), zt(t, r.i);
  } finally {
    r.e.z();
  }
}
var O, He = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length").get, Me = Uint8Array.prototype.subarray;
function Be(t) {
  if (typeof t == "string") return t.length;
  try {
    const e = He.call(t);
    if (e < 65536) return 0;
    const n = Object.getPrototypeOf(t);
    if (n !== Uint8Array.prototype && !(typeof Buffer == "function" && n === Buffer.prototype)) return 0;
    for (const r of [
      "length",
      "buffer",
      "byteOffset",
      "byteLength",
      "subarray"
    ]) if (Object.getOwnPropertyDescriptor(t, r)) return 0;
    return n === Uint8Array.prototype && t.subarray !== Me ? 0 : e;
  } catch {
    return 0;
  }
}
function Ee(t, e) {
  if (O === void 0) {
    O = null;
    try {
      typeof process == "object" && typeof process.versions?.node == "string" && typeof process.getBuiltinModule == "function" && (O = process.getBuiltinModule("node:crypto").createHash);
    } catch {
    }
  }
  if (O)
    try {
      return new Uint8Array(O(t).update(typeof e == "string" ? nt(e) : e).digest());
    } catch {
    }
}
function N(t, e, n) {
  const r = t(), o = new Int32Array(r.get()), s = r.outputLen, i = (c) => {
    typeof c != "string" && C(c);
    const a = st(e);
    if (n && Be(c) >= 65536) {
      const f = Ee(n, c);
      if (f) return f;
    }
    a.i.set(o);
    const u = Rt(a, c);
    a.e.d(Gt(a, 0, u), u);
    const l = a.m.slice(X, X + s);
    return a.e.z(), l;
  };
  return i.outputLen = s, i.blockLen = r.blockLen, i.create = t, r.f = e, e.g = r.get, Qt.set(r.constructor, r), i;
}
function Mn(t) {
  const { iHash: e, oHash: n } = t, r = pt(e);
  if (r && pt(n) === r && !e.pos && !n.pos && e.length + n.length === 2 * r.blockLen) return r;
}
function Je(t, e, n, r, o) {
  const s = st(e.f), i = n.length;
  s.i.set(t.iHash.get()), s.i.set(t.oHash.get(), 16), s.m.set(n, D), s.m.set(r, lt), s.e.p(i, o), n.set(s.m.subarray(D, D + i)), r.set(s.m.subarray(lt, lt + i)), s.e.z();
}
function Bn(t, e, n, r, o) {
  const s = n.slice();
  for (; o > 0; o -= 2 ** 30) Je(t, e, n, s, Math.min(o, 2 ** 30));
  r.set(s.subarray(0, r.length)), s.fill(0);
}
function Ke(t, e, n, r, o) {
  const s = new WebAssembly.Instance(t.s ||= new WebAssembly.Module(dt(t.t))).exports, i = 128 * n, c = i * (r + o + 1);
  return s.m.grow(Math.ceil(c / 65536)), new Int32Array(s.m.buffer).set([
    r,
    i,
    65536,
    65536 + i * o,
    65536 + i * (o + r),
    c
  ]), Ft(s, e), s;
}
function Ft(t, e, n) {
  const r = new Int32Array(e.buffer), o = new Int32Array(t.m.buffer, 65536, r.length);
  for (let s = 0; s < r.length; s++) {
    const i = s & -16 | s * 5 & 15;
    n ? r[i] = o[s] : o[s] = r[i];
  }
}
function En(t, e, n, r, o, s) {
  const i = Ke(t, e, n, r, o), c = 2 * r, a = c * o, u = Math.max(Math.floor(a / 1e4), 1);
  try {
    for (let l = 0, f, h; l < a; l = f)
      h = Math.floor(l / c), f = s ? Math.min(a, (Math.floor(l / u) + 1) * u, (h + 1) * c) : (h + 1) * c, n && i.s(h, l - h * c, f - h * c), s && (!(f % u) || f === a) && s(f / a);
    Ft(i, e, 1);
  } finally {
    i.w();
  }
}
var Ce = "3 {n0 ci+A K* G,j(Q-S)k)I*&)-(J9))KDID&6,+*)0/.-43218765&4-(J9j*(Q95)k)Q+(J-j*J(9(Q18)I)Q+(J-))J(J*,)(Qj v)(T(9^)I(9I(:k0 DI(:k; D ?I(:k, B ? 6I(B 6I(Gk: DI(Gk< D ?I(Gk3 B ? 6J(9I(0k)Q+(J1 P& 6I(9 6I(-k/ DI(-k4 D ?I(-kB D ? 6I(/I(-I(.I(/ ? = ? 6K(0I(, 6J(,I(0I()k+ DI()k6 D ?I()k? D ? 6I()I(* =I(+I()I(* > = > 6J(0(Q1B)I)I(J*,)I)Q+(J-)) 6`+(J-))I*k!/) 6J*I+k* 7K+6)44g+* K* G,jI*I, 6I)I, 6&)-)K-I-&6,+*)0/.-43218765&4-)I,k9 6K,I+s6)44O** GI)I*&;K+I+&60/.-,+*)87654321&F)a,)4", De = "3 o #0 V|+A J* G,j(Q9O)I*&3,(J1))KDID&60/.-,+*)87654321&F)J(9(Q1;)I)R,(J1))lI UJ(J*,)(Qz v)(T(9^)I(9I(:l* VI(:l1 V QI(:l0 T Q HI(B HI(Gl< VI(Glg V QI(Gl/ T Q HJ(9I(0k)R,(J1 L& HI(9 HI(-l7 VI(-l; V QI(-lR V Q HI(/I(-I(.I(/ Q O Q HK(0I(, HJ(,I(0I()lE VI()lK V QI()lP V Q HI()I(* OI(+I()I(* P O P HJ(0(Q1H)I)I(J*,)I)R,(J1))lI U HlI Ua,(J1))I*k L* 6J*I+k* 7K+6)44g+* K* G,jI*I, 6I)I, 6&)-)K-I-&6,+*)0/.-43218765&4-)I,k9 6K,I+s6)44O** GI)I*&;K+I+&60/.-,+*)87654321&F)a,)4", Ue = "3 h@0!';*- K,j(Q-8)I)Q+(J-))J(J*,)(Qj ;)I(*I()I*Q+([ 6k)Q+(J1 L& 6(T9)8)I(,I(*I(+I(, ? = ?(TI98)I(+I(,I(*I(+ ? = ?(TYI4)I(*I(+ ?I(, ?(TjY7)I(+I(*I(,k K ? > ? 6k(Z C 6J()(Q-B)I)I(J*,)I)Q+(J-)) 6`+(J-))I*k!/) 6J*I+k* 7K+6)44N** K,jI*I, 6I)I, 6&)-)&4-)I,k9 6K,I+s6)442)I)I*a,)4", _e = "3 cQ0'K+> K* G,j(Q-S)k)I*&)-(J9))KAIA&6,+*)0/.-43218765&4-(J9j*(Q95)k)Q+(J-j*J(9(Q.8)I)Q+(J-))J(J*,)(Qz o)(T(9>)I(FI(A ?I(; ?I(9 ?k* CJ(9I(-I(9 6(T=)?)k f!c U!C. 6I(,I(*I(+I(, ? = ?(TQ=;)k n!F!V!f/ 6I(*I(+ ?I(, ?(TfQC)k!K!i!^!h D 6I(*I(+ =I(,I(*I(+ > = >(Tzf;)k!E O W!B H 6I(*I(+ ?I(, ? 6I()k. C 6J(-I(*kG CJ(*(Q.B)I)I(J*,)I)Q+(J-)) 6`+(J-))I*k!/) 6J*I+k* 7K+6)44g+* K* G,jI*I, 6I)I, 6&)-)K-I-&6,+*)0/.-43218765&4-)I,k9 6K,I+s6)44O** GI)I*&;K+I+&60/.-,+*)87654321&F)a,)4", je = ") - ? 9*)))*H/ ,, K K K) ,+ K K* K ,+ K H) ,+ K K) ,)) ,+ K J),10)).*+,-.,*)*0>.* 9+)* A),* 0)-* <).* F)/(S Y**+ K+jI)-jk(L)I) 7K,I*I,I*sDJ+k L,I) 6k L.I+%3))I)I+ 6K)k(L)q6*k)k L,k*9)4I*I+ 7k(L) :K,-jk)k L.I+ 6I,9)4I+I,k(L) 8 6J+I*I+ 7K)-jk L,k L.I+ 6I)%3))44k L.k)I*%4)I)4 *)I)k L*d) L,k M,I) 6k)k(L)k* 7I) 7%4)I)k(L* 6k(L)u-jk)k L,k*9)k L,k)k(L)%4)4k(L+I*%0l, R9+k)k L,k*9)k)k L*k!/)9*4!!+** JI)k L*d) L,k(L+I)k(L) 6 zl, RK+9+k(L,I+9+,j(Q-=)k)k)&)-(J9))&4-(J9)*k L+k L,k*9)k L+k L-I)9*I)k L*`+ L-(Q-=)k)k)&)-(J9j)&4-(J9)*k L+k L-k*9)k L+k L,I)9*I)k L*`+ L,(Q-I)k)k)&)-(J9!/)k)&)-(J9 L*&{&4-(J9!/)I*k* 7K*6)445)k)k)k L/%4)4", Jn = ") - ? 9*)))*8, ,+ K K) ,)) ,, K K K),-,)+*.,*)*06,* 9+)* ?)** C)+3 L., m,+, K2 GI)k-Q+)K- 6kj 6K+&)-)J.I+&)-9J0I+&)-IJ1I+&)-YJ/,jI.I)I,k/ @ 6K+&)-)&{K3J.I0I+&)-9&{K4J0I1I+&)-I&{K5J1I/I+&)-Y&{K6J/k1J+,jI.I/I1I0I.I/& {*K/k0& x*I/kB& z*&z&{K/I.& {*K.k2& x*I.k@& z*&z&{K0I/& {*K.k6& x*I.k<& z*&z&{K2I0& {*K.k;& x*I.k7& z*&z&{J.I0I0&612345678)*+,-./0J1I2I2&6-./012345678)*+,J0I/I/&65678)*+,-./01234J/I+k* 7K+6)4I*I,k* Bk/ @I-k* Bk)I,k* =D 6 6K+I.I3& {*K.&4-)I+I0I4& {*K0&4-9I+I1I5& {*K1&4-II+I/I6& {*K/&4-YI,k* 6K,I-k/ Bs6)44!8**/ Kk)Q+)k* 7J.k5Q+)J/k9Q+)J0k1Q+)I)k-Q+)K) 8 6J-,jI*I+s-jI/I)I* 8 6J,I*I.s-jI*o-jI/I-I)%3))4I,I)I, 69).I*I.p-jI,I-9).I/I)I- 6kj 6Q+)I. =I) 8 6J1k)J,,jI,I0 6I,I- 6&)-)I,I1 6&)-)&{&4-)I,k9 6K,I)s6)4I0I-9)44I*k* 6J*5*444:)k1Q+)k)k=Q+)%4)4";
function Te(t, e, n, r) {
  if (typeof t.setBigUint64 == "function") return t.setBigUint64(e, n, r);
  const o = BigInt(32), s = BigInt(4294967295), i = Number(n >> o & s), c = Number(n & s), a = r ? 4 : 0, u = r ? 0 : 4;
  t.setUint32(e + a, i, r), t.setUint32(e + u, c, r);
}
var it = class extends xt {
  constructor(t, e, n, r) {
    super(), this.finished = !1, this.length = 0, this.pos = 0, this.destroyed = !1, this.blockLen = t, this.outputLen = e, this.padOffset = n, this.isLE = r, this.buffer = new Uint8Array(t), this.view = ut(this.buffer);
  }
  update(t) {
    if (q(this), Ht(this, t)) return this;
    t = Tt(t), C(t);
    const { view: e, buffer: n, blockLen: r } = this, o = t.length;
    for (let s = 0; s < o; ) {
      const i = Math.min(r - this.pos, o - s);
      if (i === r) {
        const c = ut(t);
        for (; r <= o - s; s += r) this.process(c, s);
        continue;
      }
      n.set(t.subarray(s, s + i), this.pos), this.pos += i, s += i, this.pos === r && (this.process(e, 0), this.pos = 0);
    }
    return this.length += t.length, this.roundClean(), this;
  }
  digestInto(t) {
    if (q(this), ye(t, this), this.finished = !0, Ht(this, t, 1)) return;
    const { buffer: e, view: n, blockLen: r, isLE: o } = this;
    let { pos: s } = this;
    e[s++] = 128, x(this.buffer.subarray(s)), this.padOffset > r - s && (this.process(n, 0), s = 0);
    for (let l = s; l < r; l++) e[l] = 0;
    Te(n, r - 8, BigInt(this.length * 8), o), this.process(n, 0);
    const i = ut(t), c = this.outputLen;
    if (c % 4) throw new Error("_sha2: outputLen should be aligned to 32bit");
    const a = c / 4, u = this.get();
    if (a > u.length) throw new Error("_sha2: outputLen bigger than state");
    for (let l = 0; l < a; l++) i.setUint32(4 * l, u[l], o);
  }
  digest() {
    const { buffer: t, outputLen: e } = this;
    this.digestInto(t);
    const n = t.slice(0, e);
    return this.destroy(), n;
  }
  _cloneInto(t) {
    t || (t = new this.constructor()), t.set(...this.get());
    const { blockLen: e, buffer: n, length: r, finished: o, destroyed: s, pos: i } = this;
    return t.destroyed = s, t.finished = o, t.length = r, t.pos = i, r % e && t.buffer.set(n), t;
  }
  clone() {
    return this._cloneInto();
  }
}, J = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]), g = /* @__PURE__ */ Uint32Array.from([
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
]), m = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]), Vt = /* @__PURE__ */ rt(Ce, 64, 8, 8, /* @__PURE__ */ Wt(64)), kt = /* @__PURE__ */ rt(De, 128, 16, 8, /* @__PURE__ */ Wt(80)), xe = class extends it {
  constructor(t = 32) {
    super(64, t, 8, !1), this.A = J[0] | 0, this.B = J[1] | 0, this.C = J[2] | 0, this.D = J[3] | 0, this.E = J[4] | 0, this.F = J[5] | 0, this.G = J[6] | 0, this.H = J[7] | 0;
  }
  get() {
    const { A: t, B: e, C: n, D: r, E: o, F: s, G: i, H: c } = this;
    return [
      t,
      e,
      n,
      r,
      o,
      s,
      i,
      c
    ];
  }
  set(t, e, n, r, o, s, i, c) {
    this.A = t | 0, this.B = e | 0, this.C = n | 0, this.D = r | 0, this.E = o | 0, this.F = s | 0, this.G = i | 0, this.H = c | 0;
  }
  process(t, e) {
    ot(this, t, e, Vt);
  }
  roundClean() {
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0), x(this.buffer);
  }
}, Nt = class extends it {
  constructor(t = 64) {
    super(128, t, 16, !1), this.Ah = m[0] | 0, this.Al = m[1] | 0, this.Bh = m[2] | 0, this.Bl = m[3] | 0, this.Ch = m[4] | 0, this.Cl = m[5] | 0, this.Dh = m[6] | 0, this.Dl = m[7] | 0, this.Eh = m[8] | 0, this.El = m[9] | 0, this.Fh = m[10] | 0, this.Fl = m[11] | 0, this.Gh = m[12] | 0, this.Gl = m[13] | 0, this.Hh = m[14] | 0, this.Hl = m[15] | 0;
  }
  get() {
    const { Ah: t, Al: e, Bh: n, Bl: r, Ch: o, Cl: s, Dh: i, Dl: c, Eh: a, El: u, Fh: l, Fl: f, Gh: h, Gl: d, Hh: p, Hl: y } = this;
    return [
      t,
      e,
      n,
      r,
      o,
      s,
      i,
      c,
      a,
      u,
      l,
      f,
      h,
      d,
      p,
      y
    ];
  }
  set(t, e, n, r, o, s, i, c, a, u, l, f, h, d, p, y) {
    this.Ah = t | 0, this.Al = e | 0, this.Bh = n | 0, this.Bl = r | 0, this.Ch = o | 0, this.Cl = s | 0, this.Dh = i | 0, this.Dl = c | 0, this.Eh = a | 0, this.El = u | 0, this.Fh = l | 0, this.Fl = f | 0, this.Gh = h | 0, this.Gl = d | 0, this.Hh = p | 0, this.Hl = y | 0;
  }
  process(t, e) {
    ot(this, t, e, kt);
  }
  roundClean() {
  }
  destroy() {
    x(this.buffer), this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}, Qe = class extends Nt {
  constructor() {
    super(48), this.Ah = g[0] | 0, this.Al = g[1] | 0, this.Bh = g[2] | 0, this.Bl = g[3] | 0, this.Ch = g[4] | 0, this.Cl = g[5] | 0, this.Dh = g[6] | 0, this.Dl = g[7] | 0, this.Eh = g[8] | 0, this.El = g[9] | 0, this.Fh = g[10] | 0, this.Fl = g[11] | 0, this.Gh = g[12] | 0, this.Gl = g[13] | 0, this.Hh = g[14] | 0, this.Hl = g[15] | 0;
  }
}, Oe = /* @__PURE__ */ N(() => new xe(), Vt, "sha256"), We = /* @__PURE__ */ N(() => new Nt(), kt, "sha512"), ze = /* @__PURE__ */ N(() => new Qe(), kt, "sha384"), bt = Oe, Re = "nodepod-wasm-modules", H = "wasmModules", Ge = 1, Mt = 32, Pt = 2592e6, yt = 0;
function gt() {
  return yt > 0;
}
function P(t) {
  yt++;
  try {
    return ge(bt(t));
  } finally {
    yt--;
  }
}
async function mt(t) {
  try {
    const e = globalThis.crypto?.subtle;
    if (e) {
      const n = typeof SharedArrayBuffer < "u" && t.buffer instanceof SharedArrayBuffer ? new Uint8Array(t) : t, r = await e.digest("SHA-256", n);
      return Array.from(new Uint8Array(r)).map((o) => o.toString(16).padStart(2, "0")).join("");
    }
  } catch {
  }
  return P(t);
}
function Fe() {
  return typeof indexedDB > "u" ? Promise.resolve(null) : new Promise((t) => {
    try {
      const e = indexedDB.open(Re, Ge);
      e.onupgradeneeded = () => {
        const n = e.result;
        n.objectStoreNames.contains(H) || n.createObjectStore(H);
      }, e.onsuccess = () => t(e.result), e.onerror = () => t(null);
    } catch {
      t(null);
    }
  });
}
function Ve(t, e) {
  return new Promise((n, r) => {
    try {
      const o = t.transaction(H, "readonly").objectStore(H).get(e);
      o.onsuccess = () => n(o.result ?? null), o.onerror = () => r(o.error);
    } catch (o) {
      r(o);
    }
  });
}
function Ne(t, e, n) {
  return new Promise((r, o) => {
    try {
      const s = t.transaction(H, "readwrite");
      s.objectStore(H).put(n, e), s.oncomplete = () => r(), s.onerror = () => o(s.error);
    } catch (s) {
      o(s);
    }
  });
}
function Pe(t) {
  return new Promise((e) => {
    try {
      const n = t.transaction(H, "readwrite"), r = n.objectStore(H).openCursor(), o = Date.now(), s = [];
      r.onsuccess = () => {
        const i = r.result;
        if (i) {
          const c = i.value;
          !c?.storedAt || o - c.storedAt > Pt ? i.delete() : s.push({
            key: i.key,
            storedAt: c.storedAt
          }), i.continue();
          return;
        }
        if (s.length > Mt) {
          s.sort((a, u) => a.storedAt - u.storedAt);
          const c = t.transaction(H, "readwrite").objectStore(H);
          for (const a of s.slice(0, s.length - Mt)) c.delete(a.key);
        }
        e();
      }, r.onerror = () => e(), n.onerror = () => e();
    } catch {
      e();
    }
  });
}
async function $e() {
  const t = await Fe();
  if (!t) return null;
  let e = !0;
  return {
    async get(n) {
      try {
        const r = await Ve(t, n);
        return !r?.module || Date.now() - r.storedAt > Pt || typeof WebAssembly < "u" && !(r.module instanceof WebAssembly.Module) ? null : r.module;
      } catch {
        return null;
      }
    },
    async put(n, r) {
      if (e)
        try {
          await Ne(t, n, {
            module: r,
            storedAt: Date.now()
          }), Pe(t).catch(() => {
          });
        } catch (o) {
          o?.name === "DataCloneError" && (e = !1);
        }
    },
    close() {
      try {
        t.close();
      } catch {
      }
    }
  };
}
var ft = null;
function ct() {
  return ft || (ft = $e()), ft;
}
var Kn = 4194304, I = /* @__PURE__ */ new Map(), qe = 67108864, Xe = 64;
function R() {
  let t = 0;
  for (const e of I.values()) t += e.sourceBytes;
  for (const [e, n] of I) {
    if (t <= qe && I.size <= Xe || I.size <= 1) break;
    n.module && (I.delete(e), t -= n.sourceBytes);
  }
}
function Ye(t) {
  return t.byteLength;
}
function At(t) {
  return t instanceof ArrayBuffer ? new Uint8Array(t) : new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
}
function Ze(t, e) {
  mt(t).then(async (n) => {
    const r = await ct();
    r && await r.put(n, e);
  }).catch(() => {
  });
}
async function $t(t) {
  try {
    const e = await ct();
    return e ? await e.get(t) : null;
  } catch {
    return null;
  }
}
function Cn(t, e) {
  if (j(e, W(t)), gt()) return;
  const n = P(t);
  I.set(n, {
    promise: Promise.resolve(e),
    module: e,
    sourceBytes: t.byteLength
  }), R(), Ze(t, e);
}
function Dn(t) {
  if (gt() || typeof WebAssembly > "u" || Ye(t) < 4194304) return;
  const e = At(t), n = P(e);
  if (I.has(n)) return;
  const r = e.slice(), o = {
    promise: (async () => {
      const s = await mt(r), i = I.get(n)?.module;
      if (i) return i;
      const c = await $t(s), a = I.get(n)?.module;
      if (a) return a;
      if (c)
        return j(c, W(r)), c;
      const u = await ie(() => WebAssembly.compile(r));
      return j(u, W(r)), ct().then((l) => l?.put(s, u)).catch(() => {
      }), u;
    })(),
    module: null,
    sourceBytes: r.byteLength
  };
  o.promise.then((s) => {
    o.module = s, R();
  }, () => {
    I.get(n) === o && I.delete(n);
  }), I.set(n, o), R();
}
function Un(t) {
  if (gt()) return null;
  const e = P(At(t)), n = I.get(e);
  return n?.module ? (I.delete(e), I.set(e, n), n.module) : null;
}
var L = null, tn = 1, M = /* @__PURE__ */ new Map();
function en() {
  if (L) return L;
  const t = URL.createObjectURL(new Blob([`
    self.onmessage = function(e) {
      try {
        var mod = new WebAssembly.Module(e.data.bytes);
        self.postMessage({ id: e.data.id, ok: true, module: mod });
      } catch (err) {
        self.postMessage({ id: e.data.id, ok: false, error: err.message });
      }
    };
  `], { type: "application/javascript" }));
  let e;
  try {
    e = new Worker(t);
  } finally {
    URL.revokeObjectURL(t);
  }
  return e.onmessage = (n) => {
    const { id: r, ok: o, module: s, error: i } = n.data, c = M.get(r);
    c && (M.delete(r), o ? c.resolve(s) : c.reject(new Error(i)));
  }, e.onerror = (n) => {
    const r = new Error(n.message || "Worker compilation failed");
    for (const o of M.values()) o.reject(r);
    M.clear(), e.terminate(), L === e && (L = null);
  }, L = e, e;
}
function _n(t) {
  const e = At(t), n = P(e), r = I.get(n);
  if (r) return r.promise;
  const o = e.slice(), s = (async () => {
    const c = await mt(o), a = I.get(n)?.module;
    if (a) return a;
    const u = await $t(c), l = I.get(n)?.module;
    if (l) return l;
    if (u)
      return j(u, W(o)), u;
    const f = W(o), h = await new Promise((d, p) => {
      let y;
      try {
        const k = en();
        y = tn++, M.set(y, {
          resolve: d,
          reject: p
        });
        const v = o.buffer;
        k.postMessage({
          id: y,
          bytes: v
        }, [v]);
      } catch (k) {
        if (y !== void 0 && M.delete(y), o.byteLength === 0) {
          p(k);
          return;
        }
        WebAssembly.compile(o).then(d, p);
      }
    });
    return j(h, f), ct().then((d) => d?.put(c, h)).catch(() => {
    }), h;
  })(), i = {
    promise: s,
    module: null,
    sourceBytes: e.byteLength
  };
  return s.then((c) => {
    i.module = c, R();
  }, () => {
    I.get(n) === i && I.delete(n);
  }), I.set(n, i), R(), s;
}
function jn() {
  let t = 0;
  for (const e of I.values()) e.module || t++;
  return {
    entries: I.size,
    pending: t
  };
}
function Tn() {
  for (const [t, e] of I) e.module && I.delete(t);
  L && M.size === 0 && (L.terminate(), L = null);
}
function xn(t) {
  try {
    const e = structuredClone(t);
    return j(e, Ie(t) ?? null), e;
  } catch {
    return null;
  }
}
function Qn() {
  I.clear();
  for (const t of M.values()) t.reject(/* @__PURE__ */ new Error("Nodepod runtime disposed"));
  if (M.clear(), L) {
    try {
      L.terminate();
    } catch {
    }
    L = null;
  }
}
var qt = class extends xt {
  constructor(t, e) {
    super(), this.finished = !1, this.destroyed = !1, pe(t);
    const n = Tt(e);
    if (this.iHash = t.create(), typeof this.iHash.update != "function") throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen, this.outputLen = this.iHash.outputLen;
    const r = this.blockLen, o = new Uint8Array(r);
    o.set(n.length > r ? t.create().update(n).digest() : n);
    for (let s = 0; s < o.length; s++) o[s] ^= 54;
    this.iHash.update(o), this.oHash = t.create();
    for (let s = 0; s < o.length; s++) o[s] ^= 106;
    this.oHash.update(o), x(o);
  }
  update(t) {
    return q(this), this.iHash.update(t), this;
  }
  digestInto(t) {
    q(this), C(t, this.outputLen), this.finished = !0, this.iHash.digestInto(t), this.oHash.update(t), this.oHash.digestInto(t), this.destroy();
  }
  digest() {
    const t = new Uint8Array(this.oHash.outputLen);
    return this.digestInto(t), t;
  }
  _cloneInto(t) {
    t || (t = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash: e, iHash: n, finished: r, destroyed: o, blockLen: s, outputLen: i } = this;
    return t = t, t.finished = r, t.destroyed = o, t.blockLen = s, t.outputLen = i, t.oHash = e._cloneInto(t.oHash), t.iHash = n._cloneInto(t.iHash), t;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = !0, this.oHash.destroy(), this.iHash.destroy();
  }
}, Xt = (t, e, n) => new qt(t, e).update(n).digest();
Xt.create = (t, e) => new qt(t, e);
var Yt = We, Zt = ze, te = /* @__PURE__ */ rt(_e, 64, 8, 5), ee = /* @__PURE__ */ rt(Ue, 64, 8, 4, () => on.map(BigInt), ve), U = /* @__PURE__ */ Uint32Array.from([
  1732584193,
  4023233417,
  2562383102,
  271733878,
  3285377520
]), nn = class extends it {
  constructor() {
    super(64, 20, 8, !1), this.A = U[0] | 0, this.B = U[1] | 0, this.C = U[2] | 0, this.D = U[3] | 0, this.E = U[4] | 0;
  }
  get() {
    const { A: t, B: e, C: n, D: r, E: o } = this;
    return [
      t,
      e,
      n,
      r,
      o
    ];
  }
  set(t, e, n, r, o) {
    this.A = t | 0, this.B = e | 0, this.C = n | 0, this.D = r | 0, this.E = o | 0;
  }
  process(t, e) {
    ot(this, t, e, te);
  }
  roundClean() {
  }
  destroy() {
    this.set(0, 0, 0, 0, 0), x(this.buffer);
  }
}, rn = /* @__PURE__ */ N(() => new nn(), te, "sha1"), sn = /* @__PURE__ */ Math.pow(2, 32), on = /* @__PURE__ */ Array.from({ length: 64 }, (t, e) => Math.floor(sn * Math.abs(Math.sin(e + 1)))), $ = /* @__PURE__ */ U.slice(0, 4), cn = class extends it {
  constructor() {
    super(64, 16, 8, !0), this.A = $[0] | 0, this.B = $[1] | 0, this.C = $[2] | 0, this.D = $[3] | 0;
  }
  get() {
    const { A: t, B: e, C: n, D: r } = this;
    return [
      t,
      e,
      n,
      r
    ];
  }
  set(t, e, n, r) {
    this.A = t | 0, this.B = e | 0, this.C = n | 0, this.D = r | 0;
  }
  process(t, e) {
    ot(this, t, e, ee);
  }
  roundClean() {
  }
  destroy() {
    this.set(0, 0, 0, 0), x(this.buffer);
  }
}, an = /* @__PURE__ */ N(() => new cn(), ee, "md5"), ne = rn;
function re(t) {
  switch (t) {
    case "SHA-1":
      return ne;
    case "SHA-256":
      return bt;
    case "SHA-384":
      return Zt;
    case "SHA-512":
      return Yt;
    case "MD5":
      return an;
    default:
      return null;
  }
}
function On(t) {
  const e = re(t);
  return e ? e.create() : null;
}
function Wn(t, e) {
  const n = re(t);
  return n ? Xt.create(n, e) : null;
}
function un(t) {
  const e = [
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21
  ], n = /* @__PURE__ */ new Uint32Array(64);
  for (let d = 0; d < 64; d++) n[d] = Math.floor(Math.abs(Math.sin(d + 1)) * 4294967296) >>> 0;
  let r = 1732584193, o = 4023233417, s = 2562383102, i = 271733878;
  const c = t.length * 8, a = (56 - (t.length + 1) % 64 + 64) % 64, u = new Uint8Array(t.length + 1 + a + 8);
  u.set(t), u[t.length] = 128;
  const l = new DataView(u.buffer);
  l.setUint32(u.length - 8, c >>> 0, !0), l.setUint32(u.length - 4, Math.floor(c / 4294967296), !0);
  for (let d = 0; d < u.length; d += 64) {
    const p = /* @__PURE__ */ new Uint32Array(16);
    for (let b = 0; b < 16; b++) p[b] = l.getUint32(d + b * 4, !0);
    let y = r, k = o, v = s, B = i;
    for (let b = 0; b < 64; b++) {
      let E, Q;
      b < 16 ? (E = k & v | ~k & B, Q = b) : b < 32 ? (E = B & k | ~B & v, Q = (5 * b + 1) % 16) : b < 48 ? (E = k ^ v ^ B, Q = (3 * b + 5) % 16) : (E = v ^ (k | ~B), Q = 7 * b % 16), E = E + y + n[b] + p[Q] >>> 0, y = B, B = v, v = k, k = k + (E << e[b] | E >>> 32 - e[b]) >>> 0;
    }
    r = r + y >>> 0, o = o + k >>> 0, s = s + v >>> 0, i = i + B >>> 0;
  }
  const f = /* @__PURE__ */ new Uint8Array(16), h = new DataView(f.buffer);
  return h.setUint32(0, r, !0), h.setUint32(4, o, !0), h.setUint32(8, s, !0), h.setUint32(12, i, !0), f;
}
function Bt(t, e) {
  return e ? Zt(t) : Yt(t);
}
function Et(t, e) {
  const n = new Uint8Array(t.length + e.length);
  return n.set(t, 0), n.set(e, t.length), n;
}
function ht(t, e) {
  switch (t) {
    case "SHA-1":
      return ne(e);
    case "SHA-256":
      return bt(e);
    case "SHA-384":
      return Bt(e, !0);
    case "SHA-512":
      return Bt(e, !1);
    case "MD5":
      return un(e);
    default:
      throw new Error(`crypto: synchronous digest for "${t}" is not supported in the browser polyfill`);
  }
}
function zn(t, e, n) {
  const r = t === "SHA-384" || t === "SHA-512" ? 128 : 64;
  let o = e.length > r ? ht(t, e) : e;
  const s = new Uint8Array(r);
  s.set(o);
  const i = new Uint8Array(r), c = new Uint8Array(r);
  for (let a = 0; a < r; a++)
    i[a] = s[a] ^ 54, c[a] = s[a] ^ 92;
  return ht(t, Et(c, ht(t, Et(i, n))));
}
var ln = "nodepod-tarballs", A = "tarballs", S = "meta", fn = 2, se = /* @__PURE__ */ new WeakMap(), hn = 864e5;
function Rn(t) {
  const e = se.get(t);
  return e === void 0 || Date.now() - e > hn;
}
var In = 268435456, Jt = 12096e5;
function dn() {
  return typeof indexedDB > "u" ? Promise.resolve(null) : new Promise((t) => {
    try {
      const e = indexedDB.open(ln, fn);
      let n = !1;
      e.onupgradeneeded = (r) => {
        const o = e.result, s = e.transaction;
        if (o.objectStoreNames.contains(A) || o.createObjectStore(A), !o.objectStoreNames.contains(S)) {
          const i = o.createObjectStore(S);
          if (r.oldVersion >= 1) {
            const c = s.objectStore(A).openCursor();
            c.onsuccess = () => {
              const a = c.result;
              if (!a) return;
              const u = a.value;
              i.put({
                storedAt: u?.storedAt ?? 0,
                size: u?.size ?? 0
              }, a.key), a.continue();
            };
          }
        }
      }, e.onsuccess = () => {
        if (n) {
          try {
            e.result.close();
          } catch {
          }
          return;
        }
        n = !0, e.result.onversionchange = () => {
          try {
            e.result.close();
          } catch {
          }
        }, t(e.result);
      }, e.onerror = () => {
        n = !0, t(null);
      }, e.onblocked = () => {
        n || (n = !0, t(null));
      };
    } catch {
      t(null);
    }
  });
}
function pn(t, e) {
  return new Promise((n, r) => {
    const o = t.transaction(A, "readonly").objectStore(A).get(e);
    o.onsuccess = () => n(o.result ?? null), o.onerror = () => r(o.error);
  });
}
function yn(t, e, n) {
  return new Promise((r, o) => {
    const s = t.transaction([A, S], "readwrite");
    s.objectStore(A).put(n, e), s.objectStore(S).put({
      storedAt: n.storedAt,
      size: n.size
    }, e), s.oncomplete = () => r(), s.onerror = () => o(s.error);
  });
}
async function kn() {
  const t = await dn();
  return t ? {
    async get(e) {
      try {
        const n = await pn(t, e);
        return !n?.bytes || Date.now() - n.storedAt > Jt ? null : (se.set(n.bytes, n.storedAt), n.bytes);
      } catch {
        return null;
      }
    },
    async put(e, n, r) {
      try {
        await yn(t, e, {
          bytes: n,
          integrity: r,
          storedAt: Date.now(),
          size: n.byteLength
        });
      } catch {
      }
    },
    clear() {
      return new Promise((e) => {
        try {
          const n = t.transaction([A, S], "readwrite");
          n.objectStore(A).clear(), n.objectStore(S).clear(), n.oncomplete = () => e(), n.onerror = () => e();
        } catch {
          e();
        }
      });
    },
    prune(e = In, n = Jt) {
      return new Promise((r) => {
        try {
          const o = t.transaction([A, S], "readwrite"), s = o.objectStore(A), i = o.objectStore(S).openCursor(), c = Date.now(), a = [];
          i.onsuccess = () => {
            const u = i.result;
            if (u) {
              const f = u.value;
              !f?.storedAt || c - f.storedAt > n ? (s.delete(u.key), u.delete()) : a.push({
                key: u.key,
                storedAt: f.storedAt,
                size: f.size ?? 0
              }), u.continue();
              return;
            }
            let l = a.reduce((f, h) => f + h.size, 0);
            if (l > e) {
              a.sort((p, y) => p.storedAt - y.storedAt);
              const f = t.transaction([A, S], "readwrite"), h = f.objectStore(A), d = f.objectStore(S);
              for (const p of a) {
                if (l <= e) break;
                h.delete(p.key), d.delete(p.key), l -= p.size;
              }
            }
            r();
          }, i.onerror = () => r(), o.onerror = () => r();
        } catch {
          r();
        }
      });
    },
    close() {
      try {
        t.close();
      } catch {
      }
    }
  } : null;
}
var It = null;
function Gn() {
  return It || (It = kn()), It;
}
export {
  Ie as A,
  mn as B,
  pe as C,
  ut as D,
  x as E,
  K as F,
  An as H,
  vn as I,
  Z as L,
  F as M,
  V as N,
  Sn as O,
  Y as P,
  _ as R,
  rt as S,
  Hn as T,
  wn as U,
  gn as V,
  Ln as W,
  Oe as _,
  ht as a,
  Mn as b,
  Kn as c,
  Qn as d,
  Un as f,
  jn as g,
  Cn as h,
  Wn as i,
  T as j,
  j as k,
  xn as l,
  Tn as m,
  Rn as n,
  zn as o,
  Dn as p,
  On as r,
  Xt as s,
  Gn as t,
  _n as u,
  Jn as v,
  St as w,
  En as x,
  Bn as y,
  _t as z
};

//# sourceMappingURL=tarball-cache-__C0n2zb.js.map