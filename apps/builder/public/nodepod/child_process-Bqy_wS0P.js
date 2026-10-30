import { c as Ht, n as Ne, o as Un, r as be, s as te, t as Vn } from "./event-loop-CGuYUIBq.js";
import { Ft as Jn, Qt as Zn, S as Yn, Vt as _t, Wt as Kn, Yt as on, _ as b, b as gt, g as q, h as _e, m as Je, p as Lt, qt as L, u as Qn, v as C, wt as jt, x as re, y as an, yt as Xn } from "./nodepod-Y98NXDvC.js";
import { L as Me, R as we } from "./tarball-cache-__C0n2zb.js";
import { b as es, g as me, n as dt, w as J } from "./config-BBz1Tu7H.js";
import { _ as ts, a as kt, b as ln, c as ns, d as ss, f as is, g as rs, h as os, i as as, l as ls, m as cs, n as us, o as Oe, p as ds, r as hs, s as fs, t as ps, u as ms, v as cn, y as gs } from "./pm-cli-DuCx87WQ.js";
import { _ as Mt, g as ws, i as vs, o as ys, r as bs, s as $s, t as xs } from "./script-engine-CtRdZ7fx.js";
import { s as Cs } from "./registry-client-BV27YIBO.js";
import { o as ks } from "./esbuild-engine-BdHL_6AU.js";
var Ft = {
  maxOutputBytes: 4194304,
  maxPipelineBufferBytes: 1048576,
  maxExpansionBytes: 1048576,
  maxCommandSubstitutionDepth: 32,
  maxRecursionDepth: 64,
  maxLoopIterations: 1e5,
  maxFilesystemEntries: 1e5,
  maxJobs: 64,
  maxProcesses: 128,
  commandTimeoutMs: 0
}, Wt = {
  maxOutputBytes: 268435456,
  maxPipelineBufferBytes: 67108864,
  maxExpansionBytes: 67108864,
  maxCommandSubstitutionDepth: 256,
  maxRecursionDepth: 256,
  maxLoopIterations: 1e7,
  maxFilesystemEntries: 1e6,
  maxJobs: 1024,
  maxProcesses: 2048,
  commandTimeoutMs: 6048e5
};
function Ss(t, e) {
  const n = e?.limits ?? Ft, s = t?.limits ?? {}, i = { ...n };
  for (const r of Object.keys(Ft)) {
    const o = s[r];
    o !== void 0 && (i[r] = Number.isFinite(o) && (r === "commandTimeoutMs" ? o >= 0 : o > 0) ? r === "commandTimeoutMs" && o === 0 ? 0 : Math.min(Wt[r], Math.max(1, Math.floor(o))) : n[r]);
  }
  return {
    limits: i,
    jobControl: t?.jobControl ?? e?.jobControl ?? !0
  };
}
var N = class extends Error {
  limit;
  constructor(t, e) {
    super(e), this.name = "ShellLimitError", this.limit = t;
  }
}, Es = [
  "2>&1",
  "2>>",
  "2>",
  "&>>",
  "&>",
  "<<<",
  "<<-",
  "<<",
  ">>",
  ">|",
  "<>",
  ">&-",
  ">&",
  "<&-",
  "<&",
  ";;&",
  ";;",
  ";",
  "&&",
  "||",
  "|&",
  "|",
  "&",
  "(",
  ")",
  "((",
  "))",
  "[[",
  "]]",
  "{",
  "}",
  "<",
  ">",
  "!"
].sort((t, e) => e.length - t.length);
function O(t, e, n) {
  const s = e.slice(0, n), i = s.split(`
`).length, r = n - s.lastIndexOf(`
`), o = /* @__PURE__ */ new Error(`${t} at ${i}:${r}`);
  return Object.defineProperties(o, {
    name: { value: "BashSyntaxError" },
    offset: { value: n },
    line: { value: i },
    column: { value: r }
  }), o;
}
function qt(t, e) {
  for (const n of Es) if (t.startsWith(n, e)) return n;
  return null;
}
function Te(t, e) {
  return e === 0 || /[\s;|&(){}<>!]/.test(t[e - 1] ?? "");
}
function zt(t, e) {
  const n = t[e + 1] ?? "";
  return Te(t, e) && (n === "" || /[\s;|&(){}<>]/.test(n));
}
function ht(t, e) {
  let n = 0, s = null;
  for (let i = e; i < t.length; i++) {
    const r = t[i];
    if (s) {
      r === s && t[i - 1] !== "\\" && (s = null);
      continue;
    }
    if (r === "'" || r === '"') {
      s = r;
      continue;
    }
    if (r === "\\") {
      i++;
      continue;
    }
    if (r === "(") n++;
    else if (r === ")" && --n === 0) return i;
  }
  return -1;
}
function un(t) {
  return {
    expand: !/[\'"\\]/.test(t),
    delimiter: t.replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1")
  };
}
function Ds(t) {
  const e = [];
  let n = 0, s = null;
  const i = [];
  for (; n < t.length; ) {
    const r = t[n];
    if (r === " " || r === "	" || r === "\r") {
      n++;
      continue;
    }
    if (r === `
`) {
      if (e.push({
        kind: "newline",
        value: `
`,
        start: n,
        end: ++n
      }), i.length > 0) {
        for (const u of i) {
          let h = !1;
          for (; n <= t.length; ) {
            const f = t.indexOf(`
`, n), p = f < 0 ? t.length : f, m = t.slice(n, p).replace(/\r$/, "");
            if ((u.stripTabs ? m.replace(/^\t+/, "") : m) === u.delimiter) {
              h = !0, f < 0 ? n = t.length : (e.push({
                kind: "newline",
                value: `
`,
                start: p,
                end: f + 1
              }), n = f + 1);
              break;
            }
            if (f < 0) break;
            n = f + 1;
          }
          if (!h) throw O(`here-document delimited by end-of-file (wanted '${u.delimiter}')`, t, n);
        }
        i.length = 0;
      }
      continue;
    }
    if (r === "#" && Te(t, n)) {
      for (; n < t.length && t[n] !== `
`; ) n++;
      continue;
    }
    if ((r === "<" || r === ">") && t[n + 1] === "(") {
      const u = ht(t, n + 1);
      if (u < 0) throw O("unmatched process substitution", t, n);
      e.push({
        kind: "word",
        value: t.slice(n, u + 1),
        start: n,
        end: u + 1
      }), n = u + 1;
      continue;
    }
    const o = qt(t, n);
    if (o && (!(o === "{" || o === "}") || zt(t, n)) && (o !== "!" || Te(t, n))) {
      e.push({
        kind: "operator",
        value: o,
        start: n,
        end: n + o.length
      }), (o === "<<" || o === "<<-") && (s = { stripTabs: o === "<<-" }), n += o.length;
      continue;
    }
    const l = n;
    let a = "", d = null, c = !1;
    for (; n < t.length; ) {
      const u = t[n];
      if (c) {
        if (u === `
`) {
          n++, c = !1;
          continue;
        }
        a += "\\" + u, n++, c = !1;
        continue;
      }
      if (u === "\\" && d !== "single") {
        c = !0, n++;
        continue;
      }
      if (!d && u === "$" && t[n + 1] === "(") {
        const p = ht(t, n + 1);
        if (p < 0) throw O("unmatched command substitution", t, n);
        a += t.slice(n, p + 1), n = p + 1;
        continue;
      }
      if (!d && (u === "<" || u === ">") && t[n + 1] === "(") {
        const p = ht(t, n + 1);
        if (p < 0) throw O("unmatched process substitution", t, n);
        a += t.slice(n, p + 1), n = p + 1;
        continue;
      }
      if (!d && u === "`") {
        const p = t.indexOf("`", n + 1);
        if (p < 0) throw O("unmatched command substitution", t, n);
        a += t.slice(n, p + 1), n = p + 1;
        continue;
      }
      if (d === "single") {
        a += u, n++, u === "'" && (d = null);
        continue;
      }
      if (d === "double") {
        a += u, n++, u === '"' && (d = null);
        continue;
      }
      if (u === "'") {
        d = "single", a += u, n++;
        continue;
      }
      if (u === '"') {
        d = "double", a += u, n++;
        continue;
      }
      const h = qt(t, n), f = h && (!(h === "{" || h === "}") || zt(t, n)) && (h !== "!" || Te(t, n));
      if (u === `
` || u === " " || u === "	" || f || u === "#" && Te(t, n)) break;
      a += u, n++;
    }
    if (d) throw O("unexpected end of quoted string", t, l);
    if (c) throw O("trailing backslash", t, n);
    if (a)
      e.push({
        kind: "word",
        value: a,
        start: l,
        end: n
      }), s && (i.push({
        delimiter: un(a).delimiter,
        stripTabs: s.stripTabs
      }), s = null);
    else if (n === l) throw O(`unexpected token '${t[n]}'`, t, n);
  }
  return e.push({
    kind: "eof",
    value: "",
    start: t.length,
    end: t.length
  }), e;
}
var As = class {
  tokens;
  source;
  maxDepth;
  pos = 0;
  nestedDepth = 0;
  constructor(t, e, n) {
    this.tokens = t, this.source = e, this.maxDepth = n;
  }
  parse() {
    return this.parseList(/* @__PURE__ */ new Set());
  }
  peek(t = 0) {
    return this.tokens[Math.min(this.pos + t, this.tokens.length - 1)];
  }
  advance() {
    return this.tokens[this.pos++];
  }
  accept(t) {
    return this.peek().value === t ? (this.pos++, !0) : !1;
  }
  expect(t) {
    const e = this.peek();
    if (e.value !== t) throw O(`expected '${t}', got '${e.value || "end of input"}'`, this.source, e.start);
    return this.advance();
  }
  skipNewlines() {
    for (; this.peek().kind === "newline"; ) this.advance();
  }
  parseNestedList(t) {
    if (this.nestedDepth >= this.maxDepth) throw O(`parser nesting exceeds ${this.maxDepth}`, this.source, this.peek().start);
    this.nestedDepth++;
    try {
      return this.parseList(t);
    } finally {
      this.nestedDepth--;
    }
  }
  parseList(t) {
    const e = [];
    for (this.skipNewlines(); this.peek().kind !== "eof"; ) {
      const n = this.peek();
      if (t.has(n.value) || n.value === "}" || n.value === ")") break;
      const s = this.parseAndOr(t);
      let i;
      if (this.accept(";")) {
        if (i = ";", this.accept(";")) throw O("unexpected ';;'", this.source, n.start);
      } else this.accept("&") ? i = "&" : this.peek().kind === "newline" && (i = "newline", this.skipNewlines());
      if (e.push({
        command: s,
        separator: i
      }), !i && this.peek().kind !== "eof" && !t.has(this.peek().value)) throw O(`unexpected token '${this.peek().value}'`, this.source, this.peek().start);
      i === "&" && this.skipNewlines();
    }
    return {
      kind: "list",
      entries: e
    };
  }
  parseAndOr(t) {
    const e = this.parsePipeline(t), n = [];
    for (; this.peek().value === "&&" || this.peek().value === "||"; ) {
      const s = this.advance().value;
      this.skipNewlines(), n.push({
        op: s,
        pipeline: this.parsePipeline(t)
      });
    }
    return {
      kind: "and-or",
      first: e,
      rest: n
    };
  }
  parsePipeline(t) {
    const e = this.accept("!");
    this.skipNewlines();
    const n = [this.parseCommand(t)];
    for (; this.peek().value === "|" || this.peek().value === "|&"; ) {
      const s = this.advance().value;
      this.skipNewlines();
      const i = this.parseCommand(t);
      if (s === "|&") {
        if (i.kind !== "simple") throw O("|& requires a simple command", this.source, this.peek().start);
        i.redirects.unshift({
          op: "2>&1",
          fd: 2
        });
      }
      n.push(i);
    }
    return {
      kind: "pipeline",
      commands: n,
      negated: e,
      background: !1
    };
  }
  parseCommand(t) {
    const e = this.peek();
    if (e.kind === "eof" || e.kind === "newline") throw O("expected command", this.source, e.start);
    if (e.value === "(") {
      this.advance();
      const n = this.parseNestedList(/* @__PURE__ */ new Set());
      return this.expect(")"), {
        kind: "subshell",
        body: n
      };
    }
    if (e.value === "{") {
      this.advance();
      const n = this.parseNestedList(/* @__PURE__ */ new Set());
      return this.expect("}"), {
        kind: "group",
        body: n
      };
    }
    return e.value === "if" ? this.parseIf() : e.value === "while" || e.value === "until" ? this.parseLoop(e.value) : e.value === "for" ? this.parseFor() : e.value === "case" ? this.parseCase() : e.value === "select" ? this.parseSelect() : e.value === "[[" ? this.parseConditional() : e.value === "((" ? this.parseArithmetic() : e.value === "coproc" ? this.parseCoproc() : e.value === "function" ? this.parseFunction(!0) : e.kind === "word" && this.peek(1).value === "(" && this.peek(2).value === ")" ? this.parseFunction(!1) : this.parseSimple(t);
  }
  parseSimple(t) {
    const e = [], n = [], s = [];
    let i = !1;
    for (; this.peek().kind === "word" || this.isRedirect(this.peek().value); ) {
      const r = this.peek();
      if (r.kind === "word" && /^\d+$/.test(r.value) && this.isRedirect(this.peek(1).value)) {
        const o = Number(this.advance().value), l = this.advance().value;
        if (l === ">&-" || l === "<&-") {
          s.push({
            op: l,
            fd: o
          });
          continue;
        }
        const a = this.peek();
        if (a.kind !== "word") throw O(`redirection '${l}' requires a target`, this.source, a.start);
        this.advance(), s.push({
          op: l,
          target: a.value,
          fd: o
        });
        continue;
      }
      if (this.isRedirect(r.value)) {
        const o = this.advance().value;
        if (o === "2>&1") {
          s.push({
            op: o,
            target: "1",
            fd: 2
          });
          continue;
        }
        if (o === ">&-" || o === "<&-") {
          s.push({
            op: o,
            fd: this.extractFd(o)
          });
          continue;
        }
        const l = this.peek();
        if (l.kind !== "word") throw O(`redirection '${o}' requires a target`, this.source, l.start);
        this.advance();
        const a = {
          op: o,
          target: l.value,
          fd: this.extractFd(o)
        };
        (o === "<<" || o === "<<-") && (a.heredoc = this.readHereDoc(l.value, o === "<<-")), s.push(a);
        continue;
      }
      if (this.advance(), /^[a-zA-Z_][a-zA-Z0-9_]*\+?=$/.test(r.value) && this.peek().value === "(") {
        this.advance();
        const o = [];
        for (; this.peek().kind !== "eof" && this.peek().value !== ")"; ) {
          if (this.peek().kind !== "word") throw O("invalid array assignment", this.source, this.peek().start);
          o.push(this.advance().value);
        }
        this.expect(")");
        const l = `${r.value}(${o.join(" ")})`;
        i ? n.push(l) : e.push(l);
        continue;
      }
      !i && /^[a-zA-Z_][a-zA-Z0-9_]*(?:\[[^\]]+\])?\+?=/.test(r.value) ? e.push(r.value) : (i = !0, n.push(r.value));
    }
    if (e.length === 0 && n.length === 0 && s.length === 0) throw O("expected command", this.source, this.peek().start);
    return {
      kind: "simple",
      assignments: e,
      words: n,
      redirects: s
    };
  }
  parseIf() {
    this.expect("if");
    const t = [], e = this.parseNestedList(/* @__PURE__ */ new Set(["then"]));
    this.expect("then");
    const n = this.parseNestedList(/* @__PURE__ */ new Set([
      "elif",
      "else",
      "fi"
    ]));
    for (t.push({
      condition: e,
      body: n
    }); this.accept("elif"); ) {
      const i = this.parseNestedList(/* @__PURE__ */ new Set(["then"]));
      this.expect("then");
      const r = this.parseNestedList(/* @__PURE__ */ new Set([
        "elif",
        "else",
        "fi"
      ]));
      t.push({
        condition: i,
        body: r
      });
    }
    let s;
    return this.accept("else") && (s = this.parseNestedList(/* @__PURE__ */ new Set(["fi"]))), this.expect("fi"), {
      kind: "if",
      branches: t,
      elseBody: s
    };
  }
  parseLoop(t) {
    this.expect(t);
    const e = this.parseNestedList(/* @__PURE__ */ new Set(["do"]));
    this.expect("do");
    const n = this.parseNestedList(/* @__PURE__ */ new Set(["done"]));
    return this.expect("done"), {
      kind: t,
      condition: e,
      body: n
    };
  }
  parseFor() {
    if (this.expect("for"), this.accept("((")) {
      const s = [];
      for (; this.peek().kind !== "eof" && this.peek().value !== "))"; ) s.push(this.advance().value);
      this.expect("))"), this.accept(";"), this.skipNewlines(), this.expect("do");
      const i = this.parseNestedList(/* @__PURE__ */ new Set(["done"]));
      this.expect("done");
      const r = s.join(" ").split(";").map((o) => o.trim());
      if (r.length !== 3) throw O("arithmetic for requires init, condition, and update", this.source, this.peek().start);
      return {
        kind: "arithmetic-for",
        init: r[0],
        condition: r[1],
        update: r[2],
        body: i
      };
    }
    const t = this.peek();
    if (t.kind !== "word" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t.value)) throw O("for requires a valid variable name", this.source, t.start);
    this.advance();
    let e = null;
    if (this.accept("in"))
      for (e = []; this.peek().kind === "word"; ) e.push(this.advance().value);
    this.accept(";"), this.skipNewlines(), this.expect("do");
    const n = this.parseNestedList(/* @__PURE__ */ new Set(["done"]));
    return this.expect("done"), {
      kind: "for",
      variable: t.value,
      words: e,
      body: n
    };
  }
  parseSelect() {
    this.expect("select");
    const t = this.peek();
    if (t.kind !== "word" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t.value)) throw O("select requires a valid variable name", this.source, t.start);
    this.advance();
    const e = [];
    for (this.accept("in"); this.peek().kind === "word"; ) e.push(this.advance().value);
    this.accept(";") && this.skipNewlines(), this.expect("do");
    const n = this.parseNestedList(/* @__PURE__ */ new Set(["done"]));
    return this.expect("done"), {
      kind: "select",
      variable: t.value,
      words: e,
      body: n
    };
  }
  parseConditional() {
    this.expect("[[");
    const t = [];
    for (; this.peek().kind !== "eof" && this.peek().value !== "]]" && this.peek().kind !== "newline"; ) t.push(this.advance().value);
    return this.expect("]]"), {
      kind: "conditional",
      words: t
    };
  }
  parseArithmetic() {
    this.expect("((");
    const t = [];
    for (; this.peek().kind !== "eof" && this.peek().value !== "))" && this.peek().kind !== "newline"; ) t.push(this.advance().value);
    return this.expect("))"), {
      kind: "arithmetic",
      expression: t.join(" ")
    };
  }
  parseCoproc() {
    this.expect("coproc");
    let t = "COPROC";
    return this.peek().kind === "word" && this.peek().value !== "{" && this.peek().value !== "(" && (t = this.advance().value), {
      kind: "coproc",
      name: t,
      body: this.parseCommand(/* @__PURE__ */ new Set())
    };
  }
  parseCase() {
    this.expect("case");
    const t = this.peek();
    if (t.kind !== "word") throw O("case requires a word", this.source, t.start);
    this.advance(), this.expect("in"), this.skipNewlines();
    const e = [];
    for (; this.peek().kind !== "eof" && this.peek().value !== "esac"; ) {
      const n = [], s = this.peek();
      if (s.kind !== "word") throw O("case pattern is required", this.source, s.start);
      for (n.push(this.advance().value); this.accept("|"); ) {
        const o = this.peek();
        if (o.kind !== "word") throw O("case pattern is required", this.source, o.start);
        n.push(this.advance().value);
      }
      this.expect(")");
      const i = this.parseNestedList(/* @__PURE__ */ new Set([
        ";;",
        ";&",
        ";;&",
        "esac"
      ]));
      let r = null;
      if ((this.peek().value === ";;" || this.peek().value === ";&" || this.peek().value === ";;&") && (r = this.advance().value, this.skipNewlines()), e.push({
        patterns: n,
        body: i,
        terminator: r
      }), r === null && this.peek().value !== "esac") throw O("expected ';;' or 'esac'", this.source, this.peek().start);
    }
    return this.expect("esac"), {
      kind: "case",
      word: t.value,
      clauses: e
    };
  }
  parseFunction(t) {
    if (t && (this.expect("function"), this.peek().value === "{"))
      throw O("function name is required", this.source, this.peek().start);
    const e = this.advance();
    if (e.kind !== "word") throw O("function name is required", this.source, e.start);
    return t && this.accept("(") && this.expect(")"), t || (this.expect("("), this.expect(")")), this.skipNewlines(), {
      kind: "function",
      name: e.value,
      body: this.parseCommand(/* @__PURE__ */ new Set())
    };
  }
  isRedirect(t) {
    return /^(?:\d+)?(?:>>|>|<|<>|<<-?|<<<|>&-?|<&-?|&>|&>>|2>&1)$/.test(t);
  }
  readHereDoc(t, e) {
    const { delimiter: n, expand: s } = un(t), i = this.source.indexOf(`
`, this.peek(-1).end);
    if (i < 0) return {
      delimiter: n,
      stripTabs: e,
      body: "",
      expand: s
    };
    const r = i + 1;
    let o = r;
    for (; o <= this.source.length; ) {
      const l = this.source.indexOf(`
`, o), a = l < 0 ? this.source.length : l, d = this.source.slice(o, a).replace(/\r$/, "");
      if ((e ? d.replace(/^\t+/, "") : d) === n) {
        const c = a;
        for (; this.peek().start < c; ) this.advance();
        let u = this.source.slice(r, o);
        return e && (u = u.replace(/^\t/gm, "")), {
          delimiter: n,
          stripTabs: e,
          body: u,
          expand: s
        };
      }
      if (l < 0) break;
      o = l + 1;
    }
    throw O(`here-document delimited by end-of-file (wanted '${n}')`, this.source, r);
  }
  extractFd(t) {
    const e = t.match(/^(\d+)/);
    return e ? parseInt(e[1], 10) : void 0;
  }
};
function Is(t, e = 64) {
  const n = Number.isFinite(e) ? Math.max(1, Math.floor(e)) : 64;
  return new As(Ds(t), t, n).parse();
}
function dn(t, e, n = 0, s = 64) {
  if (n > s) throw new N("maxRecursionDepth", "shell: brace expansion nesting limit exceeded");
  let i = -1, r = null;
  for (let l = 0; l < t.length; l++) {
    if (t[l] === "\\") {
      l++;
      continue;
    }
    if (r)
      t[l] === r && (r = null);
    else if (t[l] === "'" || t[l] === '"') r = t[l];
    else if (t[l] === "{") {
      i = l;
      break;
    }
  }
  if (i < 0) return [t];
  let o = 0;
  r = null;
  for (let l = i; l < t.length; l++) {
    if (t[l] === "\\") {
      l++;
      continue;
    }
    if (r) {
      t[l] === r && (r = null);
      continue;
    }
    if (t[l] === "'" || t[l] === '"') {
      r = t[l];
      continue;
    }
    if (t[l] === "{") o++;
    else if (t[l] === "}" && (o--, o === 0)) {
      const a = t.slice(i + 1, l), d = a.includes("..") ? Os(a, e) : a.split(",");
      if (d.length <= 1) return [t];
      const c = [];
      for (const u of d) for (const h of dn(t.slice(0, i) + u + t.slice(l + 1), e, n + 1, s))
        if (c.push(h), c.length > e) throw new N("maxExpansionBytes", "shell: brace expansion limit exceeded");
      return c;
    }
  }
  return [t];
}
function Os(t, e) {
  const n = t.match(/^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/);
  if (!n) return t.split(",");
  const s = parseInt(n[1], 10), i = parseInt(n[2], 10), r = parseInt(n[3] ?? (s <= i ? "1" : "-1"), 10) || 1, o = s <= i ? Math.abs(r) : -Math.abs(r), l = Math.floor(Math.abs(i - s) / Math.abs(o)) + 1;
  if (!Number.isSafeInteger(l) || l > e) throw new N("maxExpansionBytes", "shell: brace expansion limit exceeded");
  const a = [];
  if (o > 0) for (let d = s; d <= i; d += o) a.push(String(d));
  else for (let d = s; d >= i; d += o) a.push(String(d));
  return a;
}
function Bs(t, e) {
  if (t.startsWith("~")) {
    if (t === "~" || t.startsWith("~/")) return `${e.env.HOME ?? "/home/user"}${t.slice(1)}`;
    if (t === "~+" || t.startsWith("~+/")) return `${e.env.PWD ?? e.cwd}${t.slice(2)}`;
    if (t === "~-" || t.startsWith("~-/")) return `${e.env.OLDPWD ?? e.cwd}${t.slice(2)}`;
  }
  return t;
}
function He(t, e, n, s) {
  let i = 0, r = null;
  for (let o = e; o < t.length; o++) {
    const l = t[o];
    if (r) {
      l === r && t[o - 1] !== "\\" && (r = null);
      continue;
    }
    if (l === "'" || l === '"') {
      r = l;
      continue;
    }
    if (l === n) i++;
    else if (l === s && --i === 0) return o;
  }
  return -1;
}
function Gt(t, e, n) {
  if (n === "'") return t.indexOf(n, e + 1);
  for (let s = e + 1; s < t.length; s++) {
    if (t[s] !== n) continue;
    let i = 0;
    for (let r = s - 1; r >= e + 1 && t[r] === "\\"; r--) i++;
    if ((i & 1) === 0) return s;
  }
  return -1;
}
function se(t, e) {
  if (t === "?") return String(e.lastExit);
  if (t === "$") return "1";
  if (t === "0") return e.shellName ?? "nodepod";
  if (t === "#") return String(e.positional.length);
  if (t === "!") return e.lastBackgroundPid ? String(e.lastBackgroundPid) : "";
  if (t === "PIPESTATUS") return e.pipeStatuses.join(" ");
  if (t === "@" || t === "*") return e.positional.join(" ");
  const n = t.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[([@*]|\d+)\]$/);
  if (n) {
    const s = n[1], i = n[2];
    return i === "@" || i === "*" ? e.env[`${s}[@]`] ?? e.env[s] ?? "" : e.env[`${s}[${i}]`] ?? "";
  }
  if (/^\d+$/.test(t)) return e.positional[parseInt(t, 10) - 1] ?? "";
  if (e.nounset && !(t in e.env)) throw new Error(`shell: ${t}: unbound variable`);
  return e.env[t] ?? "";
}
function hn(t, e) {
  if (!t.startsWith("${") || !t.endsWith("}")) return se(t.slice(1), e);
  let n = t.slice(2, -1);
  if (n.startsWith("#")) return String(se(n.slice(1), e).length);
  const s = n.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(\^\^|\^|,,|,)$/);
  if (s) {
    const l = se(s[1], e);
    return s[2].startsWith("^") ? l.toUpperCase() : l.toLowerCase();
  }
  const i = n.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(##|#|%%|%)(.*)$/);
  if (i) {
    const l = se(i[1], e), a = i[3].replace(/\*+/g, "*");
    if (!a) return l;
    if (l.length * Math.max(1, a.length) > e.limits.maxLoopIterations) throw new N("maxLoopIterations", "shell: parameter pattern operation limit exceeded");
    const d = a.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."), c = i[2].startsWith("#") ? `^${d}` : `${d}$`, u = l.match(new RegExp(c));
    return u ? (i[2].length === 2, i[2].startsWith("#") ? l.slice(u[0].length) : l.slice(0, l.length - u[0].length)) : l;
  }
  const r = n.match(/^([a-zA-Z_][a-zA-Z0-9_]*(?:\[[^\]]+\])?|\d+|[@*?])(:?[-+=?])(.*)$/);
  if (r) {
    const [, l, a, d] = r, c = se(l, e), u = c.length === 0;
    if (a === "-" && e.env[l] === void 0 || a === ":-" && u || a === "+" && e.env[l] !== void 0 || a === ":+" && !u) return d;
    if (a === "=" || a === ":=")
      return (e.env[l] === void 0 || a === ":=" && u) && (e.env[l] = d), e.env[l];
    if ((a === "?" || a === ":?") && (e.env[l] === void 0 || a === ":?" && u))
      throw new Error(`shell: ${d || l}: parameter is unset`);
    return c;
  }
  const o = n.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(-?\d+)(?::\s*(-?\d+))?$/);
  if (o) {
    const l = se(o[1], e), a = parseInt(o[2], 10), d = o[3] === void 0 ? void 0 : parseInt(o[3], 10);
    return d === void 0 ? l.slice(a) : l.slice(a, a + d);
  }
  return se(n, e);
}
function fn(t, e) {
  if (t.length > Math.min(e.limits.maxExpansionBytes, e.limits.maxLoopIterations)) throw new N("maxLoopIterations", "shell: arithmetic expression limit exceeded");
  const n = t.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (r) => se(r, e) || "0");
  if (!/^[\d\s()+\-*/%<>&|^~!?=:]+$/.test(n)) throw new Error("shell: invalid arithmetic expression");
  let s = 0;
  for (const r of n) {
    if (r === "(" && ++s > e.limits.maxRecursionDepth) throw new N("maxRecursionDepth", "shell: arithmetic nesting limit exceeded");
    r === ")" && s--;
  }
  const i = Function(`"use strict"; return (${n});`)();
  if (typeof i == "boolean") return i ? "1" : "0";
  if (typeof i != "number" || !Number.isFinite(i)) throw new Error("shell: arithmetic overflow");
  return String(Math.trunc(i));
}
async function Ps(t, e) {
  let n = "", s = !1, i = !1, r = !1;
  for (let o = 0; o < t.length; ) {
    const l = t[o];
    if (l === "'") {
      const a = Gt(t, o, "'");
      if (a < 0) throw new Error("shell: unmatched single quote");
      r = !0, n += t.slice(o + 1, a), o = a + 1;
      continue;
    }
    if (l === '"') {
      const a = Gt(t, o, '"');
      if (a < 0) throw new Error("shell: unmatched double quote");
      r = !0;
      const d = t.slice(o + 1, a);
      n += await Ts(d, e, !1), o = a + 1;
      continue;
    }
    if (l === "\\") {
      o + 1 < t.length && (n += t[o + 1]), o += 2;
      continue;
    }
    if (l === "$" && t[o + 1] === "(" && t[o + 2] === "(") {
      const a = t.indexOf("))", o + 3);
      if (a < 0) throw new Error("shell: unmatched arithmetic expansion");
      n += fn(t.slice(o + 3, a), e), s = !0, o = a + 2;
      continue;
    }
    if (l === "$" && t[o + 1] === "(") {
      const a = He(t, o + 1, "(", ")");
      if (a < 0) throw new Error("shell: unmatched command substitution");
      const d = await e.commandSubstitution(t.slice(o + 2, a));
      n += d.stdout.replace(/\n+$/, ""), s = !0, o = a + 1;
      continue;
    }
    if (l === "`") {
      let a = o + 1;
      for (; a < t.length && t[a] !== "`"; ) a++;
      if (a >= t.length) throw new Error("shell: unmatched command substitution");
      const d = await e.commandSubstitution(t.slice(o + 1, a));
      n += d.stdout.replace(/\n+$/, ""), s = !0, o = a + 1;
      continue;
    }
    if ((l === "<" || l === ">") && t[o + 1] === "(") {
      const a = He(t, o + 1, "(", ")");
      if (a < 0) throw new Error("shell: unmatched process substitution");
      e.processSubstitution ? n += await e.processSubstitution(t.slice(o + 2, a), l === "<" ? "read" : "write") : n += t.slice(o, a + 1), o = a + 1;
      continue;
    }
    if (l === "$" && t[o + 1] === "{") {
      const a = He(t, o + 1, "{", "}");
      if (a < 0) throw new Error("shell: unmatched parameter expansion");
      n += hn(t.slice(o, a + 1), e), s = !0, o = a + 1;
      continue;
    }
    if (l === "$" && o + 1 < t.length) {
      let a = o + 2;
      if (/\d/.test(t[o + 1]) || /[?!@$#]/.test(t[o + 1])) a = o + 2;
      else for (; a < t.length && /[a-zA-Z0-9_]/.test(t[a]); ) a++;
      if (a > o + 1) {
        n += se(t.slice(o + 1, a), e), s = !0, o = a;
        continue;
      }
    }
    (l === "*" || l === "?") && (i = !0), n += l, o++;
  }
  return {
    value: n,
    split: s,
    glob: i,
    preserveEmpty: r
  };
}
async function Ts(t, e, n) {
  const s = await pn(t, e, { doubleQuoted: !0 });
  if (s.length > e.limits.maxExpansionBytes) throw new N("maxExpansionBytes", "shell: expansion limit exceeded");
  return s;
}
async function Rs(t, e) {
  if (t === '"$@"' || t === "${@}") return [...e.positional];
  if (t === '"$*"' || t === '"${*}"') return [e.positional.join(" ")];
  if (t === "$@") return [...e.positional];
  const n = t.match(/^"\$\{([A-Za-z_][A-Za-z0-9_]*)\[@\]\}"$/);
  if (n) return (e.env[`${n[1]}[@]`] ?? "").split(" ").filter((r) => r.length > 0);
  const s = [];
  let i = 0;
  for (const r of dn(Bs(t, e), Math.min(e.limits.maxExpansionBytes, e.limits.maxLoopIterations), 0, e.limits.maxRecursionDepth)) {
    const o = await Ps(r, e);
    let l = o.split ? o.value.split(/[ \t\n]+/).filter(Boolean) : [o.value];
    if (l.length === 0 && o.preserveEmpty && (l = [""]), o.glob && e.globOptions?.enabled !== !1) {
      const a = [];
      for (const d of l) {
        const c = Yn(d, e.cwd, e.volume, {
          dotglob: e.globOptions?.dotglob,
          maxEntries: e.limits.maxFilesystemEntries,
          maxOperations: e.limits.maxLoopIterations,
          maxPatternLength: e.limits.maxExpansionBytes
        });
        e.globOptions?.nullglob && c.length === 1 && c[0] === d || a.push(...c);
      }
      l = a;
    }
    s.push(...l);
    for (const a of l) i += a.length;
    if (i > e.limits.maxExpansionBytes) throw new N("maxExpansionBytes", "shell: expansion limit exceeded");
  }
  return s;
}
async function Ns(t, e) {
  const n = [];
  for (const s of t) n.push(...await Rs(s, e));
  return n;
}
async function Hs(t, e) {
  return pn(t, e, { doubleQuoted: !1 });
}
async function pn(t, e, n) {
  let s = "";
  for (let i = 0; i < t.length; ) {
    const r = t[i];
    if (r === "\\") {
      const o = t[i + 1];
      o === "\\" || o === "$" || o === "`" || o === `
` || n.doubleQuoted && o === '"' ? (o !== `
` && (s += o), i += 2) : (s += r, i++);
      continue;
    }
    if (r === "$" && t[i + 1] === "(" && t[i + 2] === "(") {
      const o = t.indexOf("))", i + 3);
      if (o < 0) throw new Error("shell: unmatched arithmetic expansion in here-document");
      s += fn(t.slice(i + 3, o), e), i = o + 2;
      continue;
    }
    if (r === "$" && t[i + 1] === "(") {
      const o = He(t, i + 1, "(", ")");
      if (o < 0) throw new Error("shell: unmatched command substitution in here-document");
      const l = await e.commandSubstitution(t.slice(i + 2, o));
      s += l.stdout.replace(/\n$/, ""), i = o + 1;
      continue;
    }
    if (r === "`") {
      const o = t.indexOf("`", i + 1);
      if (o < 0) throw new Error("shell: unmatched command substitution in here-document");
      const l = await e.commandSubstitution(t.slice(i + 1, o));
      s += l.stdout.replace(/\n$/, ""), i = o + 1;
      continue;
    }
    if (r === "$" && t[i + 1] === "{") {
      const o = He(t, i + 1, "{", "}");
      if (o < 0) throw new Error("shell: unmatched parameter expansion in here-document");
      s += hn(t.slice(i, o + 1), e), i = o + 1;
      continue;
    }
    if (r === "$" && i + 1 < t.length) {
      const o = t[i + 1];
      if (!/\d/.test(o) && !/[?!@$#]/.test(o) && !/[a-zA-Z_]/.test(o)) {
        s += r, i++;
        continue;
      }
      let l = i + 2;
      if (!/\d/.test(o) && !/[?!@$#]/.test(o)) for (; l < t.length && /[a-zA-Z0-9_]/.test(t[l]); ) l++;
      s += se(t.slice(i + 1, l), e), i = l;
      continue;
    }
    if (s += r, i++, s.length > e.limits.maxExpansionBytes) throw new N("maxExpansionBytes", "shell: here-document expansion limit exceeded");
  }
  return s;
}
var We = class {
  controller = new AbortController();
  get signal() {
    return this.controller.signal;
  }
  cancel(t) {
    this.controller.signal.aborted || this.controller.abort(t);
  }
  throwIfCancelled() {
    if (this.signal.aborted) throw this.signal.reason instanceof Error ? this.signal.reason : /* @__PURE__ */ new Error("shell: command cancelled");
  }
  onCancel(t) {
    return this.signal.aborted ? (t(), () => {
    }) : (this.signal.addEventListener("abort", t, { once: !0 }), () => this.signal.removeEventListener("abort", t));
  }
}, Ut = class {
  capacity;
  chunks = [];
  readers = [];
  writers = [];
  bytes = 0;
  ended = !1;
  failure = null;
  constructor(t) {
    if (this.capacity = t, !Number.isFinite(t) || t <= 0) throw new RangeError("shell: pipe capacity must be positive");
  }
  get bufferedBytes() {
    return this.bytes;
  }
  get capacityBytes() {
    return this.capacity;
  }
  get closed() {
    return this.ended || this.failure !== null;
  }
  async write(t, e) {
    if (t.byteLength === 0) return;
    if (t.byteLength > this.capacity) throw new N("maxPipelineBufferBytes", `shell: pipeline chunk exceeds ${this.capacity} bytes`);
    if (e?.throwIfCancelled(), this.closed) throw this.failure ?? /* @__PURE__ */ new Error("shell: write to closed pipe");
    for (; this.bytes + t.byteLength > this.capacity; )
      if (await this.waitForWriter(e), e?.throwIfCancelled(), this.closed) throw this.failure ?? /* @__PURE__ */ new Error("shell: write to closed pipe");
    const n = this.readers.shift();
    if (n) {
      n.resolve(t);
      return;
    }
    this.chunks.push(t), this.bytes += t.byteLength;
  }
  async read(t) {
    t?.throwIfCancelled();
    const e = this.chunks.shift();
    if (e)
      return this.bytes -= e.byteLength, this.releaseWriter(), e;
    if (this.failure) throw this.failure;
    if (this.ended) return null;
    let n = () => {
    };
    return new Promise((s, i) => {
      const r = {
        resolve: s,
        reject: i
      };
      this.readers.push(r), n = t?.onCancel(() => {
        const o = this.readers.indexOf(r);
        o >= 0 && this.readers.splice(o, 1), i(t.signal.reason ?? /* @__PURE__ */ new Error("shell: read cancelled"));
      }) ?? (() => {
      });
    }).finally(n);
  }
  end() {
    if (!this.closed) {
      for (this.ended = !0; this.readers.length; ) this.readers.shift().resolve(null);
      for (; this.writers.length; ) this.writers.shift().resolve();
    }
  }
  fail(t) {
    if (!this.closed) {
      for (this.failure = t instanceof Error ? t : new Error(String(t)); this.readers.length; ) this.readers.shift().reject(this.failure);
      for (; this.writers.length; ) this.writers.shift().reject(this.failure);
    }
  }
  waitForWriter(t) {
    let e = () => {
    };
    return new Promise((n, s) => {
      const i = {
        resolve: n,
        reject: s
      };
      this.writers.push(i), e = t?.onCancel(() => {
        const r = this.writers.indexOf(i);
        r >= 0 && this.writers.splice(r, 1), s(t.signal.reason ?? /* @__PURE__ */ new Error("shell: write cancelled"));
      }) ?? (() => {
      });
    }).finally(e);
  }
  releaseWriter() {
    this.writers.shift()?.resolve();
  }
};
async function _s(t, e, n) {
  const s = new TextDecoder();
  let i = 0, r = "";
  for (; ; ) {
    const o = await t.read(e);
    if (o === null) break;
    if (i += o.byteLength, i > n) throw new N("maxOutputBytes", `shell: output exceeds ${n} bytes`);
    r += s.decode(o, { stream: !0 });
  }
  return r + s.decode();
}
function mn(t) {
  return new TextEncoder().encode(t);
}
async function Y(t, e) {
  const n = mn(e);
  if (n.byteLength > t.maxOutputBytes) throw new N("maxOutputBytes", "shell: output limit exceeded");
  for (let s = 0; s < n.byteLength; s += t.output.capacityBytes) await t.output.write(n.slice(s, Math.min(s + t.output.capacityBytes, n.byteLength)), t.token);
}
async function gn(t, e) {
  for (let n = 0; n < e.byteLength; n += t.output.capacityBytes) await t.output.write(e.slice(n, Math.min(n + t.output.capacityBytes, e.byteLength)), t.token);
}
function Ls(t, e, n) {
  let s = t.split(`
`);
  if (s.length > n) throw new N("maxLoopIterations", `cat: line limit ${n} exceeded`);
  if (e.squeeze) {
    const r = [];
    let o = !1;
    for (const l of s) {
      const a = l.length === 0;
      a && o || (r.push(l), o = a);
    }
    s = r;
  }
  let i = 1;
  return s.map((r, o) => {
    let l = "";
    for (const a of r) {
      const d = a.charCodeAt(0);
      d === 9 ? l += e.showTabs ? "^I" : a : e.showNonprinting && d < 32 ? l += `^${String.fromCharCode(d + 64)}` : e.showNonprinting && d === 127 ? l += "^?" : l += a;
    }
    return e.showEnds && o < s.length - 1 && (l += "$"), e.numberNonBlank && r.length > 0 ? l = `${String(i++).padStart(6)}	${l}` : e.numberAll && (l = `${String(i++).padStart(6)}	${l}`), l;
  }).join(`
`);
}
async function he(t) {
  if (!t.input) return "";
  const e = new TextDecoder();
  let n = "", s = 0;
  for (; ; ) {
    const i = await t.input.read(t.token);
    if (i === null) break;
    if (s += i.byteLength, n += e.decode(i, { stream: !0 }), s > t.maxOutputBytes) throw new N("maxOutputBytes", "shell: input exceeds output limit");
  }
  return n + e.decode();
}
async function js(t, e) {
  let n = !0, s = !1;
  const i = [];
  for (const o of t) o === "-n" && i.length === 0 ? n = !1 : o === "-e" && i.length === 0 ? s = !0 : i.push(o);
  let r = i.join(" ");
  return s && (r = r.replace(/\\n/g, `
`).replace(/\\t/g, "	").replace(/\\\\/g, "\\")), n && (r += `
`), await Y(e, r), {
    exitCode: 0,
    stderr: ""
  };
}
async function Ms(t, e) {
  if (t.length === 0) return {
    exitCode: 0,
    stderr: ""
  };
  const n = t[0];
  let s = 1;
  return await Y(e, n.replace(/%([sdif%])/g, (i, r) => {
    if (r === "%") return "%";
    const o = t[s++] ?? "";
    return r === "d" || r === "i" ? String(parseInt(o, 10) || 0) : r === "f" ? String(parseFloat(o) || 0) : o;
  }).replace(/\\n/g, `
`).replace(/\\t/g, "	")), {
    exitCode: 0,
    stderr: ""
  };
}
async function Fs(t, e) {
  const n = (t.length ? t.join(" ") : "y") + `
`, s = mn(n.repeat(Math.max(1, Math.min(128, Math.ceil(4096 / n.length)))));
  for (; !e.token.signal.aborted; ) await gn(e, s);
  return {
    exitCode: 130,
    stderr: ""
  };
}
async function Ws(t, e) {
  const n = /* @__PURE__ */ new Set(), s = [];
  let i = !1;
  for (const r of t) if (!i && r === "--") i = !0;
  else if (!i && r.startsWith("-") && r !== "-") for (const o of r.slice(1)) n.add(o);
  else s.push(r);
  if ([
    "n",
    "b",
    "s",
    "E",
    "T",
    "A",
    "e",
    "t",
    "v"
  ].some((r) => n.has(r))) {
    let r = "";
    const o = s.length ? s : ["-"];
    for (const l of o) if (l === "-") r += await he(e);
    else {
      if (l === "/dev/null") continue;
      try {
        r += e.volume.readFileSync(gt(l, e.cwd), "utf8");
      } catch {
        return {
          exitCode: 1,
          stderr: `cat: ${l}: No such file or directory
`
        };
      }
    }
    return await Y(e, Ls(r, {
      numberAll: n.has("n"),
      numberNonBlank: n.has("b"),
      squeeze: n.has("s"),
      showEnds: n.has("E") || n.has("A") || n.has("e"),
      showTabs: n.has("T") || n.has("A") || n.has("t"),
      showNonprinting: n.has("v") || n.has("A") || n.has("e") || n.has("t")
    }, e.maxLoopIterations)), {
      exitCode: 0,
      stderr: ""
    };
  }
  if (s.length === 0 || s.length === 1 && s[0] === "-") {
    for (; ; ) {
      const r = await e.input?.read(e.token);
      if (!r) break;
      await e.output.write(r, e.token);
    }
    return {
      exitCode: 0,
      stderr: ""
    };
  }
  for (const r of s) {
    if (r === "/dev/null") continue;
    if (r === "/dev/zero") {
      const a = /* @__PURE__ */ new Uint8Array(4096);
      for (; !e.token.signal.aborted; ) await gn(e, a);
      return {
        exitCode: 130,
        stderr: ""
      };
    }
    if (r === "/dev/stdin") {
      for (; ; ) {
        const a = await e.input?.read(e.token);
        if (a == null) break;
        await e.output.write(a, e.token);
      }
      continue;
    }
    const o = gt(r, e.cwd);
    let l;
    try {
      l = e.volume.readFileSync(o, "utf8");
    } catch {
      return {
        exitCode: 1,
        stderr: `cat: ${r}: No such file or directory
`
      };
    }
    await Y(e, l);
  }
  return {
    exitCode: 0,
    stderr: ""
  };
}
async function qs(t, e) {
  let n = 10, s = null;
  for (let a = 0; a < t.length; a++) if (t[a] === "-n") {
    const d = parseInt(t[++a] ?? "10", 10);
    Number.isFinite(d) && (n = d);
  } else t[a] === "-c" ? s = parseInt(t[++a] ?? "0", 10) || 0 : /^-\d+$/.test(t[a]) && (n = parseInt(t[a].slice(1), 10));
  if (!e.input) return {
    exitCode: 0,
    stderr: ""
  };
  if (s === null && n <= 0)
    return e.cancelUpstream(), {
      exitCode: 0,
      stderr: ""
    };
  const i = new TextDecoder();
  let r = "", o = 0, l = !1;
  for (; !l; ) {
    const a = await e.input.read(e.token);
    if (a === null) break;
    const d = i.decode(a, { stream: !0 });
    if (s !== null)
      r += d, r.length >= s && (r = r.slice(0, s), l = !0);
    else {
      if (r += d, n <= 0) {
        r = "", l = !0;
        continue;
      }
      o += (d.match(/\n/g) ?? []).length, o >= n && (r = r.split(`
`).slice(0, n).join(`
`) + `
`, l = !0);
    }
  }
  return l || (r += i.decode()), await Y(e, r), l && e.cancelUpstream(), {
    exitCode: 0,
    stderr: ""
  };
}
async function zs(t, e) {
  let n = 10, s = null;
  for (let r = 0; r < t.length; r++) t[r] === "-n" ? n = Number(t[++r] ?? "10") : t[r] === "-c" ? s = Number(t[++r] ?? "0") : /^-\d+$/.test(t[r]) && (n = Number(t[r].slice(1)));
  const i = await he(e);
  return await Y(e, s !== null ? i.slice(-Math.max(0, s)) : n <= 0 ? "" : (() => {
    const r = i.endsWith(`
`), o = r ? i.slice(0, -1).split(`
`) : i.split(`
`), l = o.slice(Math.max(0, o.length - n)).join(`
`);
    return r && l.length > 0 ? `${l}
` : l;
  })()), {
    exitCode: 0,
    stderr: ""
  };
}
async function Gs(t, e) {
  const n = await he(e), s = n ? n.split(`
`).length - (n.endsWith(`
`) ? 1 : 0) : 0, i = n.trim() ? n.trim().split(/\s+/).length : 0, r = new TextEncoder().encode(n).byteLength, o = t.filter((l) => l.startsWith("-")).join("");
  return await Y(e, (o.includes("l") || o.includes("w") || o.includes("c") ? [
    o.includes("l") ? s : null,
    o.includes("w") ? i : null,
    o.includes("c") ? r : null
  ].filter((l) => l !== null) : [
    s,
    i,
    r
  ]).join(" ") + `
`), {
    exitCode: 0,
    stderr: ""
  };
}
async function Us(t, e) {
  const n = t.filter((u) => u.startsWith("-")), s = t.filter((u) => !u.startsWith("-"))[0];
  if (s === void 0) return {
    exitCode: 2,
    stderr: `grep: missing pattern
`
  };
  const i = an(s, Math.min(e.maxOutputBytes, 65536));
  if (i) return {
    exitCode: 2,
    stderr: `grep: ${i}
`
  };
  const r = n.some((u) => u.includes("v")), o = n.some((u) => u.includes("i"));
  let l;
  try {
    l = new RegExp(s, o ? "i" : "");
  } catch {
    return {
      exitCode: 2,
      stderr: `grep: Invalid regular expression: '${s}'
`
    };
  }
  const a = await he(e), d = [], c = a.split(`
`);
  if (c.length > e.maxLoopIterations) return {
    exitCode: 1,
    stderr: `grep: operation limit ${e.maxLoopIterations} exceeded
`
  };
  for (let u = 0; u < c.length; u++) {
    u > 0 && (u & 255) === 0 && await re(e.token.signal);
    const h = c[u];
    !h && a.endsWith(`
`) || l.test(h) !== r && d.push(h);
  }
  return await Y(e, d.length ? d.join(`
`) + `
` : ""), {
    exitCode: d.length ? 0 : 1,
    stderr: ""
  };
}
async function Vs(t, e) {
  const n = await he(e), s = t.includes("-r") || t.includes("--reverse"), i = t.includes("-n") || t.includes("--numeric-sort"), r = t.includes("-u") || t.includes("--unique"), o = n.replace(/\n$/, "").split(`
`).filter((a) => a.length > 0);
  if (o.length > e.maxLoopIterations) return {
    exitCode: 1,
    stderr: `sort: operation limit ${e.maxLoopIterations} exceeded
`
  };
  o.sort((a, d) => {
    const c = i ? (Number(a) || 0) - (Number(d) || 0) : a < d ? -1 : a > d ? 1 : 0;
    return s ? -c : c;
  });
  const l = (r ? o.filter((a, d) => d === 0 || a !== o[d - 1]) : o).join(`
`);
  return await Y(e, l ? l + `
` : ""), {
    exitCode: 0,
    stderr: ""
  };
}
async function Js(t, e) {
  const n = await he(e), s = t.includes("-c"), i = t.includes("-d"), r = t.includes("-u"), o = n.replace(/\n$/, "").split(`
`).filter((d) => d.length > 0);
  if (o.length > e.maxLoopIterations) return {
    exitCode: 1,
    stderr: `uniq: operation limit ${e.maxLoopIterations} exceeded
`
  };
  const l = [];
  for (let d = 0; d < o.length; d++) {
    d > 0 && (d & 255) === 0 && await re(e.token.signal);
    const c = o[d], u = l[l.length - 1];
    u?.line === c ? u.count++ : l.push({
      line: c,
      count: 1
    });
  }
  const a = l.filter((d) => (!i || d.count > 1) && (!r || d.count === 1)).map((d) => s ? `${String(d.count).padStart(7)} ${d.line}` : d.line).join(`
`);
  return await Y(e, a ? a + `
` : ""), {
    exitCode: 0,
    stderr: ""
  };
}
async function Zs(t, e) {
  const n = await he(e), s = t.indexOf("-d"), i = t.indexOf("-f"), r = s >= 0 ? t[s + 1] ?? "	" : "	", o = [];
  for (const d of (i >= 0 ? t[i + 1] ?? "" : "").split(",")) {
    const c = d.match(/^(\d+)(?:-(\d+))?$/);
    if (!c) continue;
    const u = Number(c[1]), h = Number(c[2] ?? c[1]), f = Math.max(0, h - u + 1);
    if (!Number.isSafeInteger(f) || o.length + f > e.maxLoopIterations) return {
      exitCode: 1,
      stderr: `cut: range contains more than ${e.maxLoopIterations} positions
`
    };
    for (let p = 0; p < f; p++) o.push(u + p);
  }
  if (!o.length) return {
    exitCode: 2,
    stderr: `cut: you must specify a list of bytes, characters, or fields
`
  };
  const l = n.split(`
`);
  if (l.length * o.length > e.maxLoopIterations) return {
    exitCode: 1,
    stderr: `cut: operation limit ${e.maxLoopIterations} exceeded
`
  };
  const a = [];
  for (let d = 0; d < l.length; d++) {
    d > 0 && (d & 255) === 0 && await re(e.token.signal);
    const c = l[d].split(r);
    a.push(o.map((u) => c[u - 1] ?? "").join(r));
  }
  return await Y(e, a.join(`
`)), {
    exitCode: 0,
    stderr: ""
  };
}
async function Ys(t, e) {
  const n = await he(e), s = t.includes("-d"), i = t.includes("-s"), r = t.filter((f) => !f.startsWith("-")), o = r[0] ?? "", l = r[1] ?? "", a = [...o], d = [...l];
  if (a.length + d.length > e.maxLoopIterations) return {
    exitCode: 1,
    stderr: `tr: operation limit ${e.maxLoopIterations} exceeded
`
  };
  const c = /* @__PURE__ */ new Map();
  a.forEach((f, p) => c.set(f, d[Math.min(p, Math.max(0, d.length - 1))] ?? ""));
  let u = "", h = 0;
  for (const f of n) {
    if (++h > e.maxLoopIterations) return {
      exitCode: 1,
      stderr: `tr: operation limit ${e.maxLoopIterations} exceeded
`
    };
    (h & 255) === 0 && await re(e.token.signal), !(s && c.has(f)) && (u += c.has(f) ? c.get(f) : f);
  }
  if (i && l) {
    const f = new Set(d);
    let p = "", m = "";
    for (const g of u)
      g === m && f.has(g) || (p += g, m = g);
    u = p;
  }
  return await Y(e, u), {
    exitCode: 0,
    stderr: ""
  };
}
async function Ks(t, e) {
  const n = await he(e), s = t.find((c) => c.startsWith("s/") || c.startsWith("/"));
  if (!s)
    return await Y(e, n), {
      exitCode: 0,
      stderr: ""
    };
  const i = s.match(/^s([/|#])(.*?)\1(.*?)\1([gip]*)$/);
  if (!i) return {
    exitCode: 1,
    stderr: `sed: invalid command: ${s}
`
  };
  const r = an(i[2], Math.min(e.maxOutputBytes, 65536));
  if (r) return {
    exitCode: 1,
    stderr: `sed: ${r}
`
  };
  let o;
  try {
    o = new RegExp(i[2], (i[4].includes("g") ? "g" : "") + (i[4].includes("i") ? "i" : ""));
  } catch {
    return {
      exitCode: 1,
      stderr: `sed: invalid regular expression: ${i[2]}
`
    };
  }
  const l = i[3].replace(/\\n/g, `
`), a = n.split(`
`);
  if (a.length > e.maxLoopIterations) return {
    exitCode: 1,
    stderr: `sed: operation limit ${e.maxLoopIterations} exceeded
`
  };
  const d = [];
  for (let c = 0; c < a.length; c++)
    c > 0 && (c & 255) === 0 && await re(e.token.signal), o.lastIndex = 0, d.push(a[c].replace(o, l));
  return await Y(e, d.join(`
`)), {
    exitCode: 0,
    stderr: ""
  };
}
var Qs = /* @__PURE__ */ new Set([
  "echo",
  "printf",
  "yes",
  "cat",
  "head",
  "tail",
  "wc",
  "grep",
  "sort",
  "uniq",
  "cut",
  "tr",
  "sed"
]);
function Ze(t) {
  const e = t.match(/^\/(?:usr\/(?:local\/)?)?bin\/([^/]+)$/);
  return e ? e[1] : t;
}
function Xs(t) {
  return Qs.has(Ze(t));
}
async function ei(t, e, n) {
  switch (t = Ze(t), t) {
    case "echo":
      return js(e, n);
    case "printf":
      return Ms(e, n);
    case "yes":
      return Fs(e, n);
    case "cat":
      return Ws(e, n);
    case "head":
      return qs(e, n);
    case "tail":
      return zs(e, n);
    case "wc":
      return Gs(e, n);
    case "grep":
      return Us(e, n);
    case "sort":
      return Vs(e, n);
    case "uniq":
      return Js(e, n);
    case "cut":
      return Zs(e, n);
    case "tr":
      return Ys(e, n);
    case "sed":
      return Ks(e, n);
    default:
      return {
        exitCode: 127,
        stderr: `${t}: command not found
`
      };
  }
}
var ti = class wn {
  volume;
  cwd;
  env;
  commands = /* @__PURE__ */ new Map();
  lastExit = 0;
  aliases = /* @__PURE__ */ new Map();
  history = [];
  _execQueue = Promise.resolve({
    stdout: "",
    stderr: "",
    exitCode: 0
  });
  _spawnChild = null;
  shellOptions;
  pipefail = !1;
  errexit = !1;
  nounset = !1;
  globEnabled = !0;
  nullglob = !1;
  dotglob = !1;
  positional = [];
  shellName = "nodepod";
  recursionDepth = 0;
  lastBackgroundPid = 0;
  pipeStatuses = [];
  functions = /* @__PURE__ */ new Map();
  jobs = /* @__PURE__ */ new Map();
  detachedJobs = /* @__PURE__ */ new Set();
  nextJobId = 1;
  activeSignal = null;
  backgroundStdout = null;
  backgroundStderr = null;
  commandSubstitutionDepth = 0;
  arithmeticDepth = 0;
  lastCommandSubstitutionExit = 0;
  processSubstitutionCounter = 0;
  processSubstitutionScopes = [];
  directoryStack = [];
  traps = /* @__PURE__ */ new Map();
  readonlyNames = /* @__PURE__ */ new Set();
  localScopes = [];
  signalCleanup = null;
  constructor(e, n) {
    this.volume = e, this.cwd = n?.cwd ?? "/", this.env = n?.env ? { ...n.env } : {}, this.env.PWD = this.cwd, this.shellOptions = Ss(n?.shell), this.installVirtualOs(), this.loadHistory();
  }
  registerCommand(e) {
    this.commands.set(e.name, e);
  }
  setSpawnChildCallback(e) {
    this._spawnChild = e;
  }
  getSpawnChildCallback() {
    return this._spawnChild;
  }
  getCwd() {
    return this.cwd;
  }
  setCwd(e) {
    this.cwd = e, this.env.PWD = e;
  }
  getEnv() {
    return this.env;
  }
  setCancellationSignal(e) {
    if (this.signalCleanup?.(), this.signalCleanup = null, this.activeSignal = e, e) {
      const n = () => {
        const s = this.traps.get("INT") ?? this.traps.get("SIGINT") ?? this.traps.get("TERM") ?? this.traps.get("SIGTERM");
        if (!s) return;
        const i = this.activeSignal;
        this.activeSignal = null, this.exec(s).finally(() => {
          this.activeSignal = i;
        });
      };
      e.addEventListener("abort", n, { once: !0 }), this.signalCleanup = () => e.removeEventListener("abort", n);
    }
  }
  setBackgroundOutputCallbacks(e, n) {
    this.backgroundStdout = e, this.backgroundStderr = n;
  }
  async exec(e, n) {
    if (n?.signal && n.signal !== this.activeSignal) {
      const s = this.createExecutionClone();
      return s.setCancellationSignal(n.signal), s.exec(e, {
        cwd: n.cwd,
        env: n.env
      });
    }
    if (n?.cwd || n?.env) {
      const s = this._execQueue;
      let i;
      this._execQueue = new Promise((r) => {
        i = r;
      }), await s.catch(() => {
      });
      try {
        const r = await this.execWithDeadline(e, n);
        return i(r), r;
      } catch (r) {
        const o = {
          stdout: "",
          stderr: `shell: ${r instanceof Error ? r.message : String(r)}
`,
          exitCode: 1
        };
        return i(o), o;
      }
    }
    return this.execWithDeadline(e, n);
  }
  async execWithDeadline(e, n) {
    const s = this.shellOptions.limits.commandTimeoutMs;
    if (!s || s <= 0 || !Number.isFinite(s)) return this._execInner(e, n);
    const i = new AbortController(), r = this.activeSignal, o = () => i.abort(r?.reason);
    r?.addEventListener("abort", o, { once: !0 }), this.setCancellationSignal(i.signal);
    let l;
    try {
      const a = this._execInner(e, n), d = new Promise((c) => {
        l = setTimeout(() => {
          i.abort(/* @__PURE__ */ new Error("shell: command timed out")), c({
            stdout: "",
            stderr: `shell: command timed out after ${s}ms
`,
            exitCode: 124
          });
        }, s);
      });
      return await Promise.race([a, d]);
    } finally {
      l && clearTimeout(l), r?.removeEventListener("abort", o), this.setCancellationSignal(r);
    }
  }
  async _execInner(e, n) {
    const s = this.cwd, i = { ...this.env }, r = [];
    this.processSubstitutionScopes.push(r), n?.cwd && (this.cwd = n.cwd, this.env.PWD = n.cwd), n?.env && Object.assign(this.env, n.env);
    try {
      if (e.length > this.shellOptions.limits.maxExpansionBytes) throw new N("maxExpansionBytes", `shell: command exceeds ${this.shellOptions.limits.maxExpansionBytes} characters`);
      const o = e.trim();
      o && !n?.cwd && !n?.env && this.recordHistory(o);
      const l = Is(e, this.shellOptions.limits.maxRecursionDepth), a = await this.execBashList(l);
      return this.assertEnvironmentState(), new TextEncoder().encode(a.stdout).byteLength + new TextEncoder().encode(a.stderr).byteLength > this.shellOptions.limits.maxOutputBytes ? {
        stdout: "",
        stderr: `shell: output exceeds ${this.shellOptions.limits.maxOutputBytes} bytes
`,
        exitCode: 1
      } : a;
    } catch (o) {
      const l = o instanceof Error ? o.message : String(o);
      return o instanceof N && (this.cwd = s, this.env = i), {
        stdout: "",
        stderr: `${l.startsWith("shell:") ? l : `shell: ${l}`}
`,
        exitCode: 1
      };
    } finally {
      this.processSubstitutionScopes.pop();
      for (const o of r) try {
        this.volume.unlinkSync(o);
      } catch {
      }
      if (n?.cwd && this.cwd === n.cwd && (this.cwd = s, this.env.PWD = s), n?.env) for (const o of Object.keys(n.env)) o in i ? this.env[o] = i[o] : delete this.env[o];
    }
  }
  async execList(e) {
    let n = {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
    for (let s = 0; s < e.entries.length; s++) {
      const i = e.entries[s], r = await this.execPipeline(i.pipeline);
      if (n = {
        stdout: n.stdout + r.stdout,
        stderr: n.stderr + r.stderr,
        exitCode: r.exitCode
      }, this.assertCollectedOutput(n.stdout, n.stderr), this.lastExit = r.exitCode, i.next === "&&" && r.exitCode !== 0 || i.next === "||" && r.exitCode === 0) break;
    }
    return n;
  }
  async execPipeline(e) {
    if (e.commands.length === 1) return this.execCommand(e.commands[0]);
    let n, s = {
      stdout: "",
      stderr: "",
      exitCode: 0
    }, i = "";
    for (const r of e.commands) {
      const o = await this.execCommand(r, n);
      i += o.stderr, this.assertCollectedOutput(o.stdout, i), n = o.stdout, s = o;
    }
    return {
      stdout: s.stdout,
      stderr: i,
      exitCode: s.exitCode
    };
  }
  async execCommand(e, n) {
    if (this.activeSignal?.aborted) return {
      stdout: "",
      stderr: "",
      exitCode: 130
    };
    if (e.args.length === 0) {
      for (const [h, f] of Object.entries(e.assignments)) this.env[h] = f;
      return {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
    let s = [...e.args];
    const i = this.aliases.get(s[0]);
    if (i && (s = [...i.split(/\s+/), ...s.slice(1)]), s[0] === "sh" && s[1] === "-c" && s[2]) {
      const h = this.createExecutionClone();
      return this.activeSignal && h.setCancellationSignal(this.activeSignal), h.exec(s[2], {
        cwd: this.cwd,
        env: this.env
      });
    }
    const r = s[0], o = s.slice(1);
    if (n === void 0) {
      for (const h of e.redirects) if (h.type === "read") {
        const f = this.resolvePath(h.target);
        try {
          n = this.volume.readFileSync(f, "utf8");
        } catch {
          return {
            stdout: "",
            stderr: `shell: ${h.target}: No such file or directory
`,
            exitCode: 1
          };
        }
      }
    }
    const l = {};
    for (const [h, f] of Object.entries(e.assignments))
      l[h] = this.env[h], this.env[h] = f;
    const a = this.buildContext();
    let d;
    const c = Lt.get(r) ?? Lt.get(Ze(r)), u = this.commands.get(r) ?? this.commands.get(Ze(r));
    if (c)
      d = await c(o, a, n), this.cwd = a.cwd, this.env = a.env;
    else if (r === "alias") d = this.handleAlias(o);
    else if (r === "source" || r === ".") d = await this.handleSource(o);
    else if (r === "history") d = this.handleHistory(o);
    else if (u) {
      try {
        d = await u.execute(o, a);
      } catch (h) {
        d = {
          stdout: "",
          stderr: `${r}: ${h instanceof Error ? h.message : String(h)}
`,
          exitCode: 1
        };
      }
      this.cwd = a.cwd, this.env = a.env;
    } else {
      const h = this.resolveFromPath(r);
      if (h && this.commands.has("node")) {
        try {
          d = await this.commands.get("node").execute([h, ...o], a);
        } catch (f) {
          d = {
            stdout: "",
            stderr: `${r}: ${f instanceof Error ? f.message : String(f)}
`,
            exitCode: 1
          };
        }
        this.cwd = a.cwd, this.env = a.env;
      } else d = {
        stdout: "",
        stderr: `${r}: command not found
`,
        exitCode: 127
      };
    }
    for (const [h, f] of Object.entries(l)) f === void 0 ? delete this.env[h] : this.env[h] = f;
    return d = await this.applyRedirects(d, e), this.lastExit = d.exitCode, d;
  }
  async execBashList(e) {
    let n = {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
    for (const s of e.entries) {
      if (this.activeSignal?.aborted) return {
        ...n,
        exitCode: 130
      };
      const i = () => this.execBashAndOr(s.command);
      if (s.separator === "&" && this.shellOptions.jobControl) {
        const r = this.nextJobId++;
        if (this.jobs.size >= this.shellOptions.limits.maxJobs || this.jobs.size + this.detachedJobs.size >= this.shellOptions.limits.maxProcesses) return {
          stdout: n.stdout,
          stderr: `${n.stderr}shell: maximum jobs exceeded
`,
          exitCode: 1
        };
        const o = this.createExecutionClone(), l = new We();
        o.setCancellationSignal(l.signal);
        const a = o.execBashAndOr(s.command).then((d) => (this.backgroundStdout?.(d.stdout), this.backgroundStderr?.(d.stderr), {
          ...d,
          stdout: "",
          stderr: ""
        }));
        this.jobs.set(r, {
          id: r,
          command: this.describeBashCommand(s.command),
          state: "running",
          promise: a,
          shell: o,
          cancellation: l
        }), this.lastBackgroundPid = r, a.then((d) => {
          const c = this.jobs.get(r);
          c && (c.state = d.exitCode === 0 ? "done" : "failed", c.result = d);
        }, (d) => {
          const c = this.jobs.get(r);
          c && (c.state = "failed", c.result = {
            stdout: "",
            stderr: `shell: ${String(d)}
`,
            exitCode: 1
          });
        }), n = {
          stdout: "",
          stderr: "",
          exitCode: 0
        };
      } else {
        let r;
        try {
          r = await i();
        } catch (o) {
          throw o?.kind === "return" ? {
            ...o,
            stdout: n.stdout,
            stderr: n.stderr
          } : o;
        }
        if (n = {
          stdout: n.stdout + r.stdout,
          stderr: n.stderr + r.stderr,
          exitCode: r.exitCode
        }, this.assertCollectedOutput(n.stdout, n.stderr), this.errexit && r.exitCode !== 0) break;
      }
      this.lastExit = n.exitCode;
    }
    return n;
  }
  async execBashAndOr(e) {
    let n = await this.execBashPipeline(e.first);
    for (const s of e.rest) {
      if (s.op === "&&" && n.exitCode !== 0 || s.op === "||" && n.exitCode === 0) continue;
      const i = await this.execBashPipeline(s.pipeline);
      n = {
        stdout: n.stdout + i.stdout,
        stderr: n.stderr + i.stderr,
        exitCode: i.exitCode
      }, this.assertCollectedOutput(n.stdout, n.stderr);
    }
    return n;
  }
  async execBashPipeline(e) {
    if (e.commands.length > this.shellOptions.limits.maxProcesses) return {
      stdout: "",
      stderr: `shell: pipeline exceeds ${this.shellOptions.limits.maxProcesses} processes
`,
      exitCode: 1
    };
    if (e.commands.length > 1 && e.commands.every((r) => r.kind === "simple" && r.assignments.length === 0 && r.redirects.length === 0 && r.words.length > 0 && Xs(r.words[0]))) return this.execStreamPipeline(e);
    let n, s = {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
    const i = [];
    for (const r of e.commands) {
      const o = await this.execBashCommand(r, n);
      i.push(o.exitCode), s = {
        stdout: o.stdout,
        stderr: s.stderr + o.stderr,
        exitCode: o.exitCode
      }, this.assertCollectedOutput(s.stdout, s.stderr), n = o.stdout;
    }
    if (this.pipeStatuses = i, this.pipefail) {
      let r;
      for (let o = i.length - 1; o >= 0; o--) if (i[o] !== 0) {
        r = i[o];
        break;
      }
      r !== void 0 && (s.exitCode = r);
    }
    return e.negated && (s.exitCode = s.exitCode === 0 ? 1 : 0), s;
  }
  async execStreamPipeline(e) {
    const n = new We(), s = e.commands.map(() => new We()), i = this.activeSignal;
    let r = () => {
    };
    if (i)
      if (i.aborted) n.cancel(i.reason);
      else {
        const h = () => n.cancel(i.reason);
        i.addEventListener("abort", h, { once: !0 }), r = () => i.removeEventListener("abort", h);
      }
    const o = e.commands.slice(0, -1).map(() => new Ut(this.shellOptions.limits.maxPipelineBufferBytes)), l = new Ut(this.shellOptions.limits.maxPipelineBufferBytes), a = [], d = [], c = e.commands.map(async (h, f) => {
      const p = s[f], m = f === e.commands.length - 1 ? l : o[f], g = f === 0 ? null : o[f - 1], w = () => {
        for (let v = 0; v < f; v++) s[v].cancel(/* @__PURE__ */ new Error("shell: downstream command closed pipe"));
      };
      let x = [];
      try {
        x = await this.expandBashWords(h.words), n.onCancel(() => p.cancel(n.signal.reason)), n.signal.aborted && p.cancel(n.signal.reason);
        const v = await ei(x[0], x.slice(1), {
          cwd: this.cwd,
          env: this.env,
          volume: this.volume,
          input: g,
          output: m,
          token: p,
          maxOutputBytes: this.shellOptions.limits.maxOutputBytes,
          maxLoopIterations: this.shellOptions.limits.maxLoopIterations,
          cancelUpstream: w
        });
        a[f] = v.exitCode, v.stderr && (d[f] = v.stderr);
      } catch (v) {
        const $ = p.signal.reason;
        a[f] = p.signal.aborted ? $ instanceof Error && $.message.includes("downstream command closed pipe") ? 141 : 130 : 1, p.signal.aborted || (d[f] = `${x[0] ?? h.words[0] ?? "command"}: ${v instanceof Error ? v.message : String(v)}
`);
      } finally {
        f > 0 && w(), m.end();
      }
    }), u = _s(l, n, this.shellOptions.limits.maxOutputBytes).catch((h) => {
      throw n.cancel(h), h;
    });
    try {
      await Promise.all(c);
      let h = "";
      try {
        h = await u;
      } catch (p) {
        return {
          stdout: "",
          stderr: `shell: ${p instanceof Error ? p.message : String(p)}
`,
          exitCode: 1
        };
      }
      this.pipeStatuses = a;
      let f = a[a.length - 1] ?? 0;
      if (this.pipefail) {
        for (let p = a.length - 1; p >= 0; p--) if (a[p] !== 0) {
          f = a[p];
          break;
        }
      }
      return e.negated && (f = f === 0 ? 1 : 0), {
        stdout: h,
        stderr: d.filter(Boolean).join(""),
        exitCode: f
      };
    } finally {
      r();
    }
  }
  async execBashCommand(e, n) {
    if (e.kind === "simple") return this.execBashSimple(e, n);
    if (e.kind === "group" || e.kind === "subshell") {
      const s = this.cwd, i = this.env, r = this.lastExit;
      e.kind === "subshell" && (this.env = { ...this.env });
      const o = await this.execBashList(e.body);
      return e.kind === "subshell" && (this.cwd = s, this.env = i, this.lastExit = r), o;
    }
    if (e.kind === "function")
      return !this.functions.has(e.name) && this.functions.size >= this.shellOptions.limits.maxFilesystemEntries ? {
        stdout: "",
        stderr: `shell: function table limit exceeded
`,
        exitCode: 1
      } : (this.functions.set(e.name, e.body), {
        stdout: "",
        stderr: "",
        exitCode: 0
      });
    if (e.kind === "if") {
      for (const s of e.branches) if ((await this.execBashList(s.condition)).exitCode === 0) return this.execBashList(s.body);
      return e.elseBody ? this.execBashList(e.elseBody) : {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
    if (e.kind === "while" || e.kind === "until") {
      let s = "", i = "", r = 0, o = !1, l = !1;
      for (let a = 0; a < this.shellOptions.limits.maxLoopIterations; a++) {
        if (!await this.canContinueLoop(a)) return {
          stdout: s,
          stderr: i,
          exitCode: 130
        };
        const d = await this.execBashList(e.condition);
        if (!(e.kind === "while" ? d.exitCode === 0 : d.exitCode !== 0)) {
          o = !0;
          break;
        }
        try {
          const c = await this.execBashList(e.body);
          s += c.stdout, i += c.stderr, this.assertCollectedOutput(s, i), r = c.exitCode;
        } catch (c) {
          if (c?.kind === "break") {
            l = !0;
            break;
          }
          if (c?.kind === "continue") continue;
          throw c;
        }
      }
      return !o && !l ? {
        stdout: s,
        stderr: `${i}shell: loop iteration limit exceeded
`,
        exitCode: 1
      } : {
        stdout: s,
        stderr: i,
        exitCode: r
      };
    }
    if (e.kind === "for") {
      const s = e.words ? await this.expandBashWords(e.words) : [...this.positional];
      let i = "", r = "", o = 0;
      const l = Math.min(s.length, this.shellOptions.limits.maxLoopIterations);
      for (let a = 0; a < l; a++) {
        if (!await this.canContinueLoop(a)) return {
          stdout: i,
          stderr: r,
          exitCode: 130
        };
        this.env[e.variable] = s[a];
        try {
          const d = await this.execBashList(e.body);
          i += d.stdout, r += d.stderr, this.assertCollectedOutput(i, r), o = d.exitCode;
        } catch (d) {
          if (d?.kind === "break") break;
          if (d?.kind === "continue") continue;
          throw d;
        }
      }
      return l < s.length ? {
        stdout: i,
        stderr: `${r}shell: loop iteration limit exceeded
`,
        exitCode: 1
      } : {
        stdout: i,
        stderr: r,
        exitCode: o
      };
    }
    if (e.kind === "arithmetic-for") {
      let s = "", i = "", r = 0, o = !1, l = !1;
      await this.evalArithmeticExpression(e.init);
      for (let a = 0; a < this.shellOptions.limits.maxLoopIterations; a++) {
        if (!await this.canContinueLoop(a)) return {
          stdout: s,
          stderr: i,
          exitCode: 130
        };
        if (!await this.evalArithmeticExpression(e.condition)) {
          o = !0;
          break;
        }
        let d = !1;
        try {
          const c = await this.execBashList(e.body);
          s += c.stdout, i += c.stderr, this.assertCollectedOutput(s, i), r = c.exitCode;
        } catch (c) {
          if (c?.kind === "break") {
            l = !0;
            break;
          }
          if (c?.kind === "continue") d = !0;
          else throw c;
        }
        await this.evalArithmeticExpression(e.update);
      }
      return !o && !l ? {
        stdout: s,
        stderr: `${i}shell: loop iteration limit exceeded
`,
        exitCode: 1
      } : {
        stdout: s,
        stderr: i,
        exitCode: r
      };
    }
    return e.kind === "case" ? this.execBashCase(e) : e.kind === "conditional" ? this.execBashConditional(e) : e.kind === "arithmetic" ? this.execBashArithmetic(e) : e.kind === "select" ? this.execBashSelect(e, n) : e.kind === "coproc" ? this.execBashCoproc(e) : {
      stdout: "",
      stderr: `shell: unsupported command
`,
      exitCode: 2
    };
  }
  async execBashCase(e) {
    const n = this.expandCaseText(e.word);
    let s = -1;
    for (let a = 0; a < e.clauses.length; a++) if (e.clauses[a].patterns.some((d) => this.casePatternMatches(n, d))) {
      s = a;
      break;
    }
    if (s < 0) return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
    let i = "", r = "", o = 0, l = s;
    for (; l < e.clauses.length; ) {
      const a = e.clauses[l], d = await this.execBashList(a.body);
      if (i += d.stdout, r += d.stderr, this.assertCollectedOutput(i, r), o = d.exitCode, a.terminator === ";&") {
        l++;
        continue;
      }
      if (a.terminator === ";;&") {
        for (l++; l < e.clauses.length && !e.clauses[l].patterns.some((c) => this.casePatternMatches(n, c)); )
          l++;
        continue;
      }
      break;
    }
    return {
      stdout: i,
      stderr: r,
      exitCode: o
    };
  }
  async execBashArithmetic(e) {
    try {
      const n = await this.evalArithmeticExpression(e.expression);
      return {
        stdout: "",
        stderr: "",
        exitCode: Number.isFinite(n) && n !== 0 ? 0 : 1
      };
    } catch (n) {
      return {
        stdout: "",
        stderr: `shell: ${n.message}
`,
        exitCode: 2
      };
    }
  }
  async evalArithmeticExpression(e) {
    if (this.arithmeticDepth >= this.shellOptions.limits.maxRecursionDepth) throw new N("maxRecursionDepth", "shell: arithmetic nesting limit exceeded");
    this.arithmeticDepth++;
    try {
      return await this.evalArithmeticExpressionUnchecked(e);
    } finally {
      this.arithmeticDepth--;
    }
  }
  async evalArithmeticExpressionUnchecked(e) {
    const n = e.trim(), s = n.match(/^([A-Za-z_][A-Za-z0-9_]*)(\+\+|--)$/);
    if (s) {
      const o = Number(this.env[s[1]] ?? "0") || 0, l = o + (s[2] === "++" ? 1 : -1);
      return this.env[s[1]] = String(l), s[2] === "++", o;
    }
    const i = n.match(/^([A-Za-z_][A-Za-z0-9_]*)(\+=|-=|\*=|\/=|=)(.*)$/);
    if (i) {
      const o = await this.evalArithmeticExpression(i[3]), l = Number(this.env[i[1]] ?? "0") || 0, a = i[2] === "+=" ? l + o : i[2] === "-=" ? l - o : i[2] === "*=" ? l * o : i[2] === "/=" ? l / (o || 1) : o;
      return this.env[i[1]] = String(Math.trunc(a)), a;
    }
    const r = (await this.expandBashWords([`$(( ${n} ))`]))[0] ?? "0";
    return Number(r) || 0;
  }
  async execBashConditional(e) {
    const n = e.words.map((a) => this.expandCaseText(a));
    let s = 0, i = 0;
    const r = () => {
      if (++i > this.shellOptions.limits.maxRecursionDepth) throw new N("maxRecursionDepth", "shell: conditional nesting limit exceeded");
      try {
        if (n[s] === "(") {
          s++;
          const c = l();
          return n[s] === ")" && s++, c;
        }
        if (n[s] === "!")
          return s++, !r();
        const a = n[s++] ?? "";
        if ((/* @__PURE__ */ new Set([
          "-e",
          "-f",
          "-d",
          "-r",
          "-w",
          "-x",
          "-s",
          "-b",
          "-c",
          "-p",
          "-L",
          "-h",
          "-v",
          "-n",
          "-z"
        ])).has(a)) {
          const c = n[s++] ?? "";
          if (a === "-n") return c.length > 0;
          if (a === "-z") return c.length === 0;
          if (a === "-v") return Object.prototype.hasOwnProperty.call(this.env, c);
          try {
            const u = this.volume.statSync(this.resolvePath(c));
            if (a === "-e") return !0;
            if (a === "-f") return u.isFile();
            if (a === "-d") return u.isDirectory();
            if (a === "-s") return u.isFile() && this.volume.readFileSync(this.resolvePath(c)).byteLength > 0;
            if (a === "-r" || a === "-w" || a === "-x") try {
              return this.volume.accessSync(this.resolvePath(c), a === "-r" ? 4 : a === "-w" ? 2 : 1), !0;
            } catch {
              return !1;
            }
            return !0;
          } catch {
            return !1;
          }
        }
        const d = n[s];
        if (d && [
          "=",
          "==",
          "!=",
          "=~",
          "<",
          ">",
          "-eq",
          "-ne",
          "-lt",
          "-le",
          "-gt",
          "-ge",
          "-nt",
          "-ot",
          "-ef"
        ].includes(d)) {
          s++;
          const c = n[s++] ?? "";
          if (d === "=" || d === "==") return this.casePatternMatches(a, c);
          if (d === "!=") return !this.casePatternMatches(a, c);
          if (d === "=~") try {
            return new RegExp(c).test(a);
          } catch {
            return !1;
          }
          if ([
            "-eq",
            "-ne",
            "-lt",
            "-le",
            "-gt",
            "-ge"
          ].includes(d)) {
            const u = Number(a) || 0, h = Number(c) || 0;
            return d === "-eq" ? u === h : d === "-ne" ? u !== h : d === "-lt" ? u < h : d === "-le" ? u <= h : d === "-gt" ? u > h : u >= h;
          }
          try {
            const u = this.volume.statSync(this.resolvePath(a)), h = this.volume.statSync(this.resolvePath(c));
            return d === "-nt" ? u.mtimeMs > h.mtimeMs : d === "-ot" ? u.mtimeMs < h.mtimeMs : this.volume.realpathSync(this.resolvePath(a)) === this.volume.realpathSync(this.resolvePath(c));
          } catch {
            return !1;
          }
        }
        return a.length > 0;
      } finally {
        i--;
      }
    }, o = () => {
      let a = r();
      for (; n[s] === "&&" || n[s] === "-a"; )
        s++, a = r() && a;
      return a;
    }, l = () => {
      let a = o();
      for (; n[s] === "||" || n[s] === "-o"; )
        s++, a = o() || a;
      return a;
    };
    return {
      stdout: "",
      stderr: "",
      exitCode: l() ? 0 : 1
    };
  }
  async execBashSelect(e, n) {
    const s = await this.expandBashWords(e.words), i = (n ?? "").split(/\r?\n/).filter((d) => d.length > 0);
    let r = "", o = "", l = 0;
    const a = Math.min(i.length, this.shellOptions.limits.maxLoopIterations);
    for (let d = 0; d < a; d++) {
      if (!await this.canContinueLoop(d)) return {
        stdout: r,
        stderr: o,
        exitCode: 130
      };
      const c = i[d], u = Number.parseInt(c, 10) - 1;
      this.env.REPLY = c, this.env[e.variable] = u >= 0 && u < s.length ? s[u] : "";
      try {
        const h = await this.execBashList(e.body);
        r += h.stdout, o += h.stderr, this.assertCollectedOutput(r, o), l = h.exitCode;
      } catch (h) {
        if (h?.kind === "break") break;
        throw h;
      }
    }
    return a < i.length ? {
      stdout: r,
      stderr: `${o}shell: loop iteration limit exceeded
`,
      exitCode: 1
    } : {
      stdout: r,
      stderr: o,
      exitCode: l
    };
  }
  async execBashCoproc(e) {
    if (!this.shellOptions.jobControl || this.jobs.size >= this.shellOptions.limits.maxJobs || this.jobs.size + this.detachedJobs.size >= this.shellOptions.limits.maxProcesses) return {
      stdout: "",
      stderr: `coproc: maximum jobs exceeded
`,
      exitCode: 1
    };
    const n = this.nextJobId++, s = this.createExecutionClone(), i = new We();
    s.setCancellationSignal(i.signal);
    const r = s.execBashCommand(e.body);
    return this.jobs.set(n, {
      id: n,
      command: `coproc ${e.name}`,
      state: "running",
      promise: r,
      shell: s,
      cancellation: i
    }), this.lastBackgroundPid = n, this.env.COPROC_PID = String(n), this.env[`${e.name}_PID`] = String(n), r.then((o) => {
      const l = this.jobs.get(n);
      l && (l.state = o.exitCode === 0 ? "done" : "failed", l.result = o);
    }, (o) => {
      const l = this.jobs.get(n);
      l && (l.state = "failed", l.result = {
        stdout: "",
        stderr: `${String(o)}
`,
        exitCode: 1
      });
    }), {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  expandCaseText(e) {
    let n = e.replace(/'([^']*)'/g, "$1").replace(/"([^"]*)"/g, "$1");
    return n = n.replace(/\\(.)/g, "$1"), n = n.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (s, i) => this.env[i] ?? ""), n = n.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (s, i) => this.env[i] ?? ""), n;
  }
  casePatternMatches(e, n) {
    const s = this.expandCaseText(n).replace(/\*+/g, "*");
    if (e.length * Math.max(1, s.length) > this.shellOptions.limits.maxLoopIterations) throw new N("maxLoopIterations", "shell: case pattern operation limit exceeded");
    let i = "^";
    for (let r = 0; r < s.length; r++) {
      const o = s[r];
      if (o === "*") i += ".*";
      else if (o === "?") i += ".";
      else if (o === "[") {
        const l = s.indexOf("]", r + 1);
        if (l < 0) i += "\\[";
        else {
          let a = s.slice(r + 1, l);
          a.startsWith("!") && (a = "^" + a.slice(1)), i += `[${a}]`, r = l;
        }
      } else i += o.replace(/[\\^$+.()|{}]/g, "\\$&");
    }
    try {
      return new RegExp(`${i}$`).test(e);
    } catch {
      return !1;
    }
  }
  async execBashSimple(e, n) {
    this.lastCommandSubstitutionExit = 0;
    const s = {};
    for (const u of e.assignments) {
      const h = u.indexOf("="), f = h < 0 ? u : u.slice(0, h);
      if (this.readonlyNames.has(f) && f in this.env) return {
        stdout: "",
        stderr: `shell: ${f}: readonly variable
`,
        exitCode: 1
      };
      const p = h < 0 ? "" : u.slice(h + 1), m = p.match(/^\((.*)\)$/s);
      if (m && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f)) {
        const g = m[1].match(/'[^']*'|"[^"]*"|[^\s]+/g) ?? [];
        if (g.length > this.shellOptions.limits.maxLoopIterations) return {
          stdout: "",
          stderr: `shell: array element limit exceeded
`,
          exitCode: 1
        };
        const w = [];
        for (const x of g) w.push((await this.expandBashWords([x]))[0] ?? "");
        s[f] = w.join(" "), s[`${f}[@]`] = w.join(" "), w.forEach((x, v) => {
          s[`${f}[${v}]`] = x;
        });
        continue;
      }
      s[f] = (await this.expandBashWords([p])).join(" ");
    }
    const i = await this.expandBashWords(e.words);
    let r = 0;
    for (; i.length > 0 && (i[0] === "command" || i[0] === "builtin" || i[0] === "exec"); )
      if (i.shift(), ++r > this.shellOptions.limits.maxRecursionDepth) return {
        stdout: "",
        stderr: `shell: command prefix limit exceeded
`,
        exitCode: 1
      };
    if (i.length === 0) {
      const u = Object.keys(s).filter((h) => !(h in this.env)).length;
      return Object.keys(this.env).length + u > this.shellOptions.limits.maxFilesystemEntries ? {
        stdout: "",
        stderr: `shell: variable table limit exceeded
`,
        exitCode: 1
      } : (Object.assign(this.env, s), {
        stdout: "",
        stderr: "",
        exitCode: this.lastCommandSubstitutionExit
      });
    }
    if (/^(?:\/usr)?\/bin\/(?:ba)?sh$/.test(i[0]) && (i[0] = i[0].slice(i[0].lastIndexOf("/") + 1)), (i[0] === "bash" || i[0] === "sh") && i[1] === "-c") {
      const u = this.positional, h = this.shellName;
      this.positional = i.slice(3), this.shellName = i[0];
      try {
        return await this.execNested(i[2] ?? "", i[0]);
      } finally {
        this.positional = u, this.shellName = h;
      }
    }
    if (i[0] === "bash" || i[0] === "sh") {
      const u = i[1];
      return u ? this.execScriptFile(u, i.slice(2), i[0]) : {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
    const o = this.resolvePath(i[0]);
    if (this.volume.existsSync(o)) try {
      const u = this.volume.readFileSync(o, "utf8");
      if (u.startsWith("#!") && /(?:^|\/)(?:ba)?sh(?:\s|$)/.test(u.slice(2, u.indexOf(`
`) < 0 ? u.length : u.indexOf(`
`)))) return this.execScriptFile(i[0], i.slice(1), i[0]);
    } catch {
    }
    if (i[0] === "set") return this.execSet(i.slice(1));
    if (i[0] === "let") return this.execLet(i.slice(1));
    if (i[0] === "getopts") return this.execGetopts(i.slice(1));
    if (i[0] === "readonly") return this.execReadonly(i.slice(1));
    if (i[0] === "local") return this.execLocal(i.slice(1));
    if (i[0] === "shopt") return this.execShopt(i.slice(1));
    if (i[0] === "jobs" || i[0] === "wait" || i[0] === "fg" || i[0] === "bg" || i[0] === "kill" || i[0] === "disown") return this.execJobsBuiltin(i[0], i.slice(1));
    if (i[0] === "trap") return this.execTrap(i.slice(1));
    if (i[0] === "break" || i[0] === "continue") throw { kind: i[0] };
    if (i[0] === "return") {
      if (this.localScopes.length === 0) return {
        stdout: "",
        stderr: "return: can only `return' from a function or sourced script\n",
        exitCode: 1
      };
      throw {
        kind: "return",
        code: parseInt(i[1] ?? "0", 10) || 0
      };
    }
    if (i[0] === "shift")
      return this.positional = this.positional.slice(parseInt(i[1] ?? "1", 10) || 1), {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    if (i[0] === "eval") return this.execNested(i.slice(1).join(" "), "eval");
    if (i[0] === "unalias") {
      for (const u of i.slice(1)) this.aliases.delete(u);
      return {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
    if (i[0] === "pushd")
      return this.directoryStack.length >= this.shellOptions.limits.maxRecursionDepth ? {
        stdout: "",
        stderr: `pushd: directory stack limit exceeded
`,
        exitCode: 1
      } : (this.directoryStack.push(this.cwd), this.exec("cd " + (i[1] ?? this.directoryStack.shift() ?? "/")));
    if (i[0] === "popd") {
      const u = this.directoryStack.pop();
      return u ? this.exec(`cd '${u.replace(/'/g, "'\\''")}'`) : {
        stdout: "",
        stderr: `popd: directory stack empty
`,
        exitCode: 1
      };
    }
    if (i[0] === "dirs") return {
      stdout: [this.cwd, ...[...this.directoryStack].reverse()].join(" ") + `
`,
      stderr: "",
      exitCode: 0
    };
    const l = this.functions.get(i[0]);
    if (l) {
      if (this.recursionDepth >= this.shellOptions.limits.maxRecursionDepth) return {
        stdout: "",
        stderr: `shell: recursion depth exceeds ${this.shellOptions.limits.maxRecursionDepth}
`,
        exitCode: 1
      };
      const u = this.positional;
      this.positional = i.slice(1), this.recursionDepth++, this.localScopes.push(/* @__PURE__ */ new Map());
      try {
        return await this.execBashCommand(l);
      } catch (h) {
        if (h?.kind === "return") return {
          stdout: h.stdout ?? "",
          stderr: h.stderr ?? "",
          exitCode: h.code ?? 0
        };
        throw h;
      } finally {
        const h = this.localScopes.pop();
        for (const [f, p] of h) p === void 0 ? delete this.env[f] : this.env[f] = p;
        this.recursionDepth--, this.positional = u;
      }
    }
    const a = [];
    let d = n;
    for (const u of e.redirects) {
      const h = u.target ?? "", f = u.heredoc ? h : (await this.expandBashWords([h]))[0] ?? "";
      u.heredoc ? d = u.heredoc.expand === !1 ? u.heredoc.body : await Hs(u.heredoc.body, this.createExpansionContext()) : u.op === "<<<" ? d = (await this.expandBashWords([f])).join(" ") + `
` : u.op === "2>&1" ? a.push({
        type: "stderr-to-stdout",
        target: ""
      }) : u.op === ">&" && u.fd === 2 && f === "1" ? a.push({
        type: "stderr-to-stdout",
        target: ""
      }) : u.op === ">&" && u.fd === 1 && f === "2" ? a.push({
        type: "stdout-to-stderr",
        target: ""
      }) : u.op === ">&-" && u.fd === 2 ? a.push({
        type: "stderr-write",
        target: "/dev/null"
      }) : u.op === ">&-" && u.fd === 1 ? a.push({
        type: "write",
        target: "/dev/null"
      }) : u.op === "&>" ? (a.push({
        type: "write",
        target: f
      }), a.push({
        type: "stderr-to-stdout",
        target: ""
      })) : u.op === "&>>" ? (a.push({
        type: "append",
        target: f
      }), a.push({
        type: "stderr-to-stdout",
        target: ""
      })) : u.fd === 2 && (u.op === ">" || u.op === ">|") ? a.push({
        type: "stderr-write",
        target: f
      }) : u.fd === 2 && u.op === ">>" ? a.push({
        type: "stderr-append",
        target: f
      }) : u.op === ">" || u.op === ">|" ? a.push({
        type: "write",
        target: f
      }) : u.op === ">>" ? a.push({
        type: "append",
        target: f
      }) : u.op === "<" ? a.push({
        type: "read",
        target: f
      }) : u.op === "2>" ? a.push({
        type: "stderr-write",
        target: f
      }) : u.op === "2>>" && a.push({
        type: "stderr-append",
        target: f
      });
    }
    const c = {};
    for (const [u, h] of Object.entries(s))
      c[u] = this.env[u], this.env[u] = h;
    try {
      return await this.execCommand({
        kind: "command",
        args: i,
        redirects: a,
        assignments: {}
      }, d);
    } finally {
      for (const [u, h] of Object.entries(c)) h === void 0 ? delete this.env[u] : this.env[u] = h;
    }
  }
  async expandBashWords(e) {
    return Ns(e, this.createExpansionContext());
  }
  createExpansionContext() {
    return {
      env: this.env,
      cwd: this.cwd,
      volume: this.volume,
      lastExit: this.lastExit,
      positional: this.positional,
      lastBackgroundPid: this.lastBackgroundPid,
      pipeStatuses: this.pipeStatuses,
      nounset: this.nounset,
      shellName: this.shellName,
      globOptions: {
        enabled: this.globEnabled,
        nullglob: this.nullglob,
        dotglob: this.dotglob
      },
      limits: this.shellOptions.limits,
      commandSubstitution: async (e) => {
        if (this.commandSubstitutionDepth >= this.shellOptions.limits.maxCommandSubstitutionDepth) throw new Error(`shell: command substitution nesting exceeds ${this.shellOptions.limits.maxCommandSubstitutionDepth}`);
        this.commandSubstitutionDepth++;
        try {
          const n = this.createExecutionClone();
          n.commandSubstitutionDepth = this.commandSubstitutionDepth, n.setCancellationSignal(this.activeSignal);
          const s = await n.exec(e);
          return this.lastCommandSubstitutionExit = s.exitCode, {
            stdout: s.stdout,
            exitCode: s.exitCode
          };
        } finally {
          this.commandSubstitutionDepth--;
        }
      },
      processSubstitution: async (e, n) => {
        const s = this.processSubstitutionScopes[this.processSubstitutionScopes.length - 1];
        if (!s || s.length >= this.shellOptions.limits.maxProcesses) throw new N("maxProcesses", "shell: process substitution limit exceeded");
        const i = `/tmp/.nodepod-proc-${++this.processSubstitutionCounter}`, r = this.createExecutionClone();
        r.setCancellationSignal(this.activeSignal);
        const o = await r.exec(e);
        try {
          this.volume.writeFileSync(i, n === "read" ? o.stdout : ""), s.push(i);
        } catch {
        }
        return i;
      }
    };
  }
  execSet(e) {
    if (e.length === 0) {
      let s = "";
      for (const [i, r] of Object.entries(this.env)) s += `${i}=${r}
`;
      return {
        stdout: s,
        stderr: "",
        exitCode: 0
      };
    }
    const n = e.indexOf("--");
    n >= 0 && (this.positional = e.slice(n + 1), e = e.slice(0, n));
    for (let s = 0; s < e.length; s++) {
      const i = e[s];
      if (i === "-e") this.errexit = !0;
      else if (i === "+e") this.errexit = !1;
      else if (i === "-u") this.nounset = !0;
      else if (i === "+u") this.nounset = !1;
      else if (i === "-f") this.globEnabled = !1;
      else if (i === "+f") this.globEnabled = !0;
      else if (i === "-o" || i === "+o") {
        const r = e[++s] ?? "", o = i === "-o";
        r === "errexit" ? this.errexit = o : r === "nounset" ? this.nounset = o : r === "pipefail" && (this.pipefail = o);
      } else if (/^-\d+$/.test(i)) this.positional = this.positional.slice(parseInt(i.slice(1), 10));
      else if (!i.startsWith("-")) {
        this.positional = e.slice(s);
        break;
      }
    }
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  async execLet(e) {
    let n = 0;
    for (const s of e) n = await this.evalArithmeticExpression(s);
    return {
      stdout: "",
      stderr: "",
      exitCode: n === 0 ? 1 : 0
    };
  }
  execReadonly(e) {
    for (const n of e) {
      if (n === "-p") continue;
      const s = n.indexOf("="), i = s >= 0 ? n.slice(0, s) : n;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(i)) return {
        stdout: "",
        stderr: `readonly: ${i}: invalid name
`,
        exitCode: 1
      };
      s >= 0 && (this.env[i] = n.slice(s + 1)), this.readonlyNames.add(i);
    }
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  async execLocal(e) {
    const n = this.localScopes[this.localScopes.length - 1];
    if (!n) return {
      stdout: "",
      stderr: `local: can only be used in a function
`,
      exitCode: 1
    };
    for (const s of e) {
      const i = s.indexOf("="), r = i >= 0 ? s.slice(0, i) : s;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(r)) return {
        stdout: "",
        stderr: `local: ${r}: invalid name
`,
        exitCode: 1
      };
      n.has(r) || n.set(r, this.env[r]), this.env[r] = i >= 0 ? (await this.expandBashWords([s.slice(i + 1)]))[0] ?? "" : "";
    }
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  execGetopts(e) {
    const n = e[0] ?? "", s = e[1] ?? "OPTARG";
    let i = Number(this.env.OPTIND ?? "1") || 1;
    const r = this.positional;
    if (i > r.length) return {
      stdout: "",
      stderr: "",
      exitCode: 1
    };
    const o = r[i - 1] ?? "";
    if (!o.startsWith("-") || o === "-") return {
      stdout: "",
      stderr: "",
      exitCode: 1
    };
    if (o === "--")
      return this.env.OPTIND = String(i + 1), {
        stdout: "",
        stderr: "",
        exitCode: 1
      };
    const l = o[1], a = n.indexOf(l);
    if (a < 0)
      return this.env[s] = "?", this.env.OPTARG = l, this.env.OPTIND = String(i + 1), {
        stdout: "",
        stderr: `getopts: illegal option -- ${l}
`,
        exitCode: 0
      };
    if (n[a + 1] === ":") {
      const d = o.slice(2) || r[i] || "";
      if (!d)
        return this.env[s] = ":", this.env.OPTARG = l, this.env.OPTIND = String(i + 1), {
          stdout: "",
          stderr: "",
          exitCode: 0
        };
      this.env.OPTARG = d, this.env.OPTIND = String(o.length > 2 ? i + 1 : i + 2);
    } else
      this.env.OPTARG = "", this.env.OPTIND = String(i + 1);
    return this.env[s] = l, {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  execShopt(e) {
    let n = "show";
    const s = [];
    for (const c of e) c === "-s" ? n = "set" : c === "-u" ? n = "unset" : c === "-q" ? n = "query" : c.startsWith("-") || s.push(c);
    const i = /* @__PURE__ */ new Set(["nullglob", "dotglob"]), r = (c) => c === "nullglob" ? this.nullglob : c === "dotglob" ? this.dotglob : !1, o = (c, u) => {
      c === "nullglob" && (this.nullglob = u), c === "dotglob" && (this.dotglob = u);
    };
    if (n === "set" || n === "unset") {
      for (const c of s) {
        if (!i.has(c)) return {
          stdout: "",
          stderr: `shopt: ${c}: invalid shell option name
`,
          exitCode: 1
        };
        o(c, n === "set");
      }
      return {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
    const l = s.length ? s : [...i];
    let a = "", d = 0;
    for (const c of l) {
      if (!i.has(c)) {
        d = 1;
        continue;
      }
      n === "query" ? r(c) || (d = 1) : a += `${c}	${r(c) ? "on" : "off"}
`;
    }
    return {
      stdout: a,
      stderr: "",
      exitCode: d
    };
  }
  execTrap(e) {
    if (e.length === 0 || e[0] === "-p") {
      let s = "";
      for (const [i, r] of this.traps) s += `trap -- '${r.replace(/'/g, "'\\''")}' ${i}
`;
      return {
        stdout: s,
        stderr: "",
        exitCode: 0
      };
    }
    const n = e[0];
    for (const s of e.slice(1)) {
      const i = s.replace(/^SIG/, "");
      n === "-" || n === "" ? this.traps.delete(i) : this.traps.set(i, n);
    }
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  async execScriptFile(e, n, s) {
    const i = this.resolvePath(e);
    let r;
    try {
      r = this.volume.readFileSync(i, "utf8");
    } catch {
      return {
        stdout: "",
        stderr: `${s}: ${e}: No such file or directory
`,
        exitCode: 127
      };
    }
    if (r.startsWith("#!")) {
      const a = r.indexOf(`
`);
      r = a < 0 ? "" : r.slice(a + 1);
    }
    const o = this.positional, l = this.shellName;
    this.positional = n, this.shellName = e;
    try {
      return await this.execNested(r, s);
    } finally {
      this.positional = o, this.shellName = l;
    }
  }
  async execJobsBuiltin(e, n) {
    if (e === "jobs") {
      let r = "";
      for (const o of this.jobs.values()) r += `[${o.id}] ${o.state}	${o.command}
`;
      return {
        stdout: r,
        stderr: "",
        exitCode: 0
      };
    }
    const s = e === "kill" ? n.filter((r) => !/^-[A-Za-z]+$/.test(r)) : n, i = s.length ? s.map((r) => parseInt(r.replace(/^%/, ""), 10)).filter(Number.isFinite) : [...this.jobs.keys()];
    if (e === "wait") {
      let r = {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
      for (const o of i) {
        const l = this.jobs.get(o);
        if (!l) {
          r = {
            stdout: "",
            stderr: `wait: ${o}: no such job
`,
            exitCode: 127
          };
          continue;
        }
        r = await l.promise, this.jobs.delete(o);
      }
      return r;
    }
    if (e === "fg") {
      const r = this.jobs.get(i[0] ?? Math.max(...this.jobs.keys(), 0));
      if (!r) return {
        stdout: "",
        stderr: `fg: no such job
`,
        exitCode: 1
      };
      const o = await r.promise;
      return this.jobs.delete(r.id), o;
    }
    if (e === "bg") {
      const r = this.jobs.get(i[0] ?? Math.max(...this.jobs.keys(), 0));
      return r ? (r.state === "stopped" && (r.state = "running"), {
        stdout: "",
        stderr: "",
        exitCode: 0
      }) : {
        stdout: "",
        stderr: `bg: no such job
`,
        exitCode: 1
      };
    }
    if (e === "kill") {
      let r = 0;
      for (const o of i) {
        const l = this.jobs.get(o);
        l && (l.cancellation.cancel(/* @__PURE__ */ new Error("shell: job terminated")), l.state = "failed", r++);
      }
      return r ? {
        stdout: "",
        stderr: "",
        exitCode: 0
      } : {
        stdout: "",
        stderr: `kill: no such job
`,
        exitCode: 1
      };
    }
    if (e === "disown") {
      for (const r of i) {
        const o = this.jobs.get(r);
        o && (this.jobs.delete(r), this.detachedJobs.add(o.promise), o.promise.then(() => this.detachedJobs.delete(o.promise), () => this.detachedJobs.delete(o.promise)));
      }
      return {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
    return {
      stdout: "",
      stderr: `${e}: job control is managed by the terminal
`,
      exitCode: 0
    };
  }
  createExecutionClone() {
    const e = new wn(this.volume, {
      cwd: this.cwd,
      env: { ...this.env },
      shell: {
        limits: { ...this.shellOptions.limits },
        jobControl: this.shellOptions.jobControl
      }
    });
    return e.commands = this.commands, e.aliases = new Map(this.aliases), e.functions = new Map(this.functions), e.pipefail = this.pipefail, e.errexit = this.errexit, e.nounset = this.nounset, e.globEnabled = this.globEnabled, e.nullglob = this.nullglob, e.dotglob = this.dotglob, e.positional = [...this.positional], e.lastExit = this.lastExit, e.recursionDepth = this.recursionDepth, e.commandSubstitutionDepth = this.commandSubstitutionDepth, e.arithmeticDepth = this.arithmeticDepth, e.traps = new Map(this.traps), e.readonlyNames = new Set(this.readonlyNames), e.setSpawnChildCallback(this._spawnChild), e.setBackgroundOutputCallbacks(this.backgroundStdout, this.backgroundStderr), e;
  }
  describeBashCommand(e) {
    const n = e.first.commands[0];
    return n.kind === "simple" ? n.words[0] ?? "(command)" : `(${n.kind})`;
  }
  assertCollectedOutput(e, n) {
    const s = this.shellOptions.limits.maxOutputBytes;
    if (e.length + n.length > s) throw new N("maxOutputBytes", `shell: output exceeds ${s} bytes`);
  }
  assertEnvironmentState() {
    const e = Object.entries(this.env);
    if (e.length > this.shellOptions.limits.maxFilesystemEntries) throw new N("maxFilesystemEntries", "shell: variable table limit exceeded");
    let n = 0;
    for (const [s, i] of e)
      if (n += s.length + i.length + 2, n > this.shellOptions.limits.maxExpansionBytes) throw new N("maxExpansionBytes", "shell: environment size limit exceeded");
  }
  async canContinueLoop(e) {
    if (this.activeSignal?.aborted) return !1;
    if (e > 0 && (e & 255) === 0) try {
      await re(this.activeSignal ?? void 0);
    } catch {
      return !1;
    }
    return !this.activeSignal?.aborted;
  }
  buildContext() {
    return {
      cwd: this.cwd,
      env: { ...this.env },
      volume: this.volume,
      signal: this.activeSignal ?? void 0,
      limits: this.shellOptions.limits,
      exec: (e, n) => {
        const s = this.createExecutionClone(), i = n?.signal ?? this.activeSignal;
        return i && s.setCancellationSignal(i), s.exec(e, {
          cwd: n?.cwd,
          env: n?.env
        });
      }
    };
  }
  installVirtualOs() {
    try {
      this.volume.mkdirSync("/tmp", {
        recursive: !0,
        mode: 1023
      }), this.volume.mkdirSync("/dev", {
        recursive: !0,
        mode: 493
      });
      for (const e of [
        "null",
        "stdin",
        "stdout",
        "stderr",
        "zero"
      ]) {
        const n = `/dev/${e}`;
        this.volume.existsSync(n) || this.volume.writeFileSync(n, "");
      }
      this.volume.mkdirSync("/bin", {
        recursive: !0,
        mode: 493
      });
      for (const e of ["sh", "bash"]) {
        const n = `/bin/${e}`;
        this.volume.existsSync(n) || (this.volume.writeFileSync(n, `# built into the nodepod shell
`), this.volume.chmodSync(n, 493));
      }
    } catch {
    }
  }
  resolvePath(e) {
    return e.startsWith("/") ? this.normalizePath(e) : this.normalizePath(`${this.cwd}/${e}`);
  }
  resolveFromPath(e) {
    const n = (this.env.PATH || "").split(":");
    for (const s of n) {
      if (!s) continue;
      const i = `${s}/${e}`;
      if (this.volume.existsSync(i))
        try {
          const r = this.volume.readFileSync(i, "utf8").slice(0, 65536), o = r.match(/node\s+"([^"]+)"/);
          if (o && this.volume.existsSync(o[1])) return o[1];
          if (r.startsWith("#!/") || r.startsWith("'use strict'") || r.startsWith('"use strict"') || r.startsWith("var ") || r.startsWith("const ") || r.startsWith("import ") || r.startsWith("module.")) return i;
        } catch {
        }
    }
    return null;
  }
  normalizePath(e) {
    const n = e.split("/").filter(Boolean), s = [];
    for (const i of n) i === ".." ? s.pop() : i !== "." && s.push(i);
    return "/" + s.join("/");
  }
  async applyRedirects(e, n) {
    let { stdout: s, stderr: i, exitCode: r } = e, o = { kind: "capture" }, l = { kind: "capture" }, a = !1, d = !1;
    const c = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), h = this.shellOptions.limits.maxOutputBytes * 32, f = (w, x) => {
      const v = this.resolvePath(w);
      if (c.get(v) === void 0 || !x) {
        let $ = "";
        if (x && this.volume.existsSync(v)) try {
          $ = this.volume.readFileSync(v, "utf8");
        } catch {
          $ = "";
        }
        if ($.length > h) throw new N("maxOutputBytes", `shell: redirected file exceeds ${h} bytes`);
        c.set(v, $);
      }
      return u.set(v, w), {
        kind: "file",
        path: v,
        append: x
      };
    };
    for (const w of n.redirects) w.type === "stderr-to-stdout" ? (l = o, a = !0) : w.type === "stdout-to-stderr" ? (o = l, d = !0) : w.type === "write" ? o = f(w.target, !1) : w.type === "append" ? o = f(w.target, !0) : w.type === "stderr-write" ? l = f(w.target, !1) : w.type === "stderr-append" && (l = f(w.target, !0));
    const p = a && o.kind === "capture", m = d && l.kind === "capture", g = (w, x) => {
      if (w.kind !== "file") return;
      const v = (c.get(w.path) ?? "") + x;
      if (v.length > h) throw new N("maxOutputBytes", `shell: redirected file exceeds ${h} bytes`);
      c.set(w.path, v);
    };
    g(o, s), g(l, i), p ? (s += i, i = "") : m && (i += s, s = "");
    for (const [w, x] of c)
      if (w !== "/dev/null")
        try {
          const v = this.normalizePath(w.substring(0, w.lastIndexOf("/")));
          v && v !== "/" && !this.volume.existsSync(v) && this.volume.mkdirSync(v, { recursive: !0 }), this.volume.writeFileSync(w, x);
        } catch (v) {
          const $ = u.get(w) ?? w;
          i += `shell: ${$}: ${v instanceof Error ? v.message : "Cannot write"}
`, r = 1;
        }
    return o.kind === "file" && (s = ""), l.kind === "file" && (i = ""), {
      stdout: s,
      stderr: i,
      exitCode: r
    };
  }
  historyPath() {
    const e = this.env.HISTFILE;
    return e ? e.startsWith("/") ? e : this.resolvePath(e) : `${this.env.HOME || "/home/user"}/.nodepod_history`;
  }
  loadHistory() {
    try {
      const e = this.historyPath();
      if (!this.volume.existsSync(e)) return;
      const n = this.volume.readFileSync(e, "utf8"), s = n.length > this.shellOptions.limits.maxOutputBytes ? n.slice(-this.shellOptions.limits.maxOutputBytes) : n;
      this.history = s.split(`
`).filter((i) => i.length > 0), this.trimHistory();
    } catch {
    }
  }
  persistHistory() {
    try {
      const e = this.historyPath(), n = this.normalizePath(e.substring(0, e.lastIndexOf("/")));
      n && n !== "/" && !this.volume.existsSync(n) && this.volume.mkdirSync(n, { recursive: !0 }), this.trimHistory(), this.volume.writeFileSync(e, this.history.join(`
`) + (this.history.length ? `
` : ""));
    } catch {
    }
  }
  recordHistory(e) {
    !e || e === "history" || (this.history.push(e), this.persistHistory());
  }
  trimHistory() {
    const e = parseInt(this.env.HISTSIZE || "1000", 10), n = Number.isFinite(e) ? Math.max(0, Math.min(e, this.shellOptions.limits.maxFilesystemEntries)) : 1e3;
    n === 0 ? this.history = [] : this.history.length > n && (this.history = this.history.slice(-n));
    const s = this.shellOptions.limits.maxOutputBytes;
    let i = 0, r = this.history.length;
    for (; r > 0; ) {
      const o = this.history[r - 1].length + 1;
      if (i + o > s) break;
      i += o, r--;
    }
    r > 0 && (this.history = this.history.slice(r));
  }
  handleHistory(e) {
    let n = "";
    for (let s = 0; s < this.history.length; s++) n += `  ${String(s + 1).padStart(4)}  ${this.history[s]}
`;
    return {
      stdout: n,
      stderr: "",
      exitCode: 0
    };
  }
  async expandCommandSubstitution(e) {
    let n = "", s = 0;
    for (; s < e.length; ) {
      if (e[s] === "'") {
        for (n += "'", s++; s < e.length && e[s] !== "'"; ) n += e[s++];
        s < e.length && (n += e[s++]);
        continue;
      }
      if (e[s] === "$" && e[s + 1] === "(") {
        s += 2;
        let i = 1, r = "";
        for (; s < e.length && i > 0; )
          e[s] === "(" && i++, e[s] === ")" && i--, i > 0 && (r += e[s]), s++;
        const o = await this.exec(r);
        n += o.stdout.replace(/\n$/, "");
        continue;
      }
      if (e[s] === "`") {
        s++;
        let i = "";
        for (; s < e.length && e[s] !== "`"; ) i += e[s++];
        s < e.length && s++;
        const r = await this.exec(i);
        n += r.stdout.replace(/\n$/, "");
        continue;
      }
      n += e[s++];
    }
    return n;
  }
  handleAlias(e) {
    if (e.length === 0) {
      let n = "";
      for (const [s, i] of this.aliases) n += `alias ${s}='${i}'
`;
      return {
        stdout: n,
        stderr: "",
        exitCode: 0
      };
    }
    for (const n of e) {
      const s = n.indexOf("=");
      if (s > 0) {
        let i = n.slice(s + 1);
        (i.startsWith("'") && i.endsWith("'") || i.startsWith('"') && i.endsWith('"')) && (i = i.slice(1, -1));
        const r = n.slice(0, s);
        if (!this.aliases.has(r) && this.aliases.size >= this.shellOptions.limits.maxFilesystemEntries) return {
          stdout: "",
          stderr: `alias: alias table limit exceeded
`,
          exitCode: 1
        };
        this.aliases.set(r, i);
      } else {
        const i = this.aliases.get(n);
        return i ? {
          stdout: `alias ${n}='${i}'
`,
          stderr: "",
          exitCode: 0
        } : {
          stdout: "",
          stderr: `alias: ${n}: not found
`,
          exitCode: 1
        };
      }
    }
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
  async handleSource(e) {
    if (e.length === 0) return {
      stdout: "",
      stderr: `source: missing file argument
`,
      exitCode: 1
    };
    const n = this.resolvePath(e[0]);
    try {
      const s = this.volume.readFileSync(n, "utf8");
      return this.execNested(s, "source");
    } catch {
      return {
        stdout: "",
        stderr: `source: ${e[0]}: No such file or directory
`,
        exitCode: 1
      };
    }
  }
  async execNested(e, n) {
    if (this.recursionDepth >= this.shellOptions.limits.maxRecursionDepth) return {
      stdout: "",
      stderr: `${n}: recursion depth exceeds ${this.shellOptions.limits.maxRecursionDepth}
`,
      exitCode: 1
    };
    this.recursionDepth++;
    try {
      return await this.exec(e);
    } finally {
      this.recursionDepth--;
    }
  }
};
function vn(t, e) {
  if (t === null || ![
    "string",
    "number",
    "boolean",
    "object"
  ].includes(typeof t)) {
    const n = /* @__PURE__ */ new TypeError("The message argument must be a string, number, boolean, or object");
    throw n.code = "ERR_INVALID_ARG_TYPE", n;
  }
  return e === "advanced" ? t : JSON.parse(JSON.stringify(t));
}
function tt(t) {
  let e = 0;
  for (; e < t.length && (t[e] === "-s" || t[e] === "--silent"); ) e++;
  return {
    silent: t.slice(0, e),
    params: t.slice(e)
  };
}
var G = "\x1B[0m", Vt = "\x1B[1m", U = "\x1B[36m";
function ni(t) {
  return {
    name: "npm",
    async execute(e, n) {
      const { silent: s, params: i } = tt(e);
      if (!t.hasFile("/")) return {
        stdout: "",
        stderr: `Volume unavailable
`,
        exitCode: 1
      };
      const r = i[0];
      if (!r || r === "help" || r === "--help") return {
        stdout: `${Vt}Usage:${G} npm <command>

${Vt}Commands:${G}
  ${U}run${G} <script>      Run a package.json script
  ${U}start${G}             Alias for npm run start
  ${U}test${G}              Alias for npm run test
  ${U}install${G} [pkg]     Install packages
  ${U}ci${G}                Clean install from package-lock.json
  ${U}uninstall${G} <pkg>   Remove a package
  ${U}ls${G}                List installed packages
  ${U}init${G}              Create a package.json
  ${U}create${G} <pkg>      Create a project (runs create-<pkg>)
  ${U}version${G}           Show version info
  ${U}info${G} <pkg>        Show package info
  ${U}exec${G} <cmd>        Execute a package binary
  ${U}pkg${G}               Get/set package.json fields
  ${U}pack${G}              Create a tarball
  ${U}config${G}            Manage configuration
`,
        stderr: "",
        exitCode: 0
      };
      switch (r) {
        case "run":
        case "run-script":
          return t.runScript([...s, ...i.slice(1)], n);
        case "start":
          return t.runScript([...s, "start"], n);
        case "test":
        case "t":
        case "tst":
          return t.runScript([...s, "test"], n);
        case "install":
        case "i":
        case "add":
          return t.installPackages(i.slice(1), n);
        case "ci":
          return t.npmCi(n, "npm");
        case "uninstall":
        case "remove":
        case "rm":
        case "un":
          return t.uninstallPackages(i.slice(1), n);
        case "ls":
        case "list":
          return t.listPackages(n, "npm", i.slice(1));
        case "init":
        case "create":
          return t.npmInitOrCreate(i.slice(1), r, n);
        case "version":
        case "-v":
        case "--version":
          return {
            stdout: J.NPM + `
`,
            stderr: "",
            exitCode: 0
          };
        case "info":
        case "view":
        case "show":
          return t.npmInfo(i.slice(1), n);
        case "exec":
          return t.npxExecute(i.slice(1), n);
        case "prefix":
          return {
            stdout: (Oe(i) ? hs : n.cwd) + `
`,
            stderr: "",
            exitCode: 0
          };
        case "root":
          return {
            stdout: (Oe(i) ? us : n.cwd) + `/node_modules
`,
            stderr: "",
            exitCode: 0
          };
        case "bin":
          return {
            stdout: (Oe(i) ? ps : n.cwd + "/node_modules/.bin") + `
`,
            stderr: "",
            exitCode: 0
          };
        case "pack":
          return t.npmPack(n);
        case "config":
        case "c":
          return t.npmConfig(i.slice(1), n);
        case "outdated":
          return t.npmOutdated(n);
        case "audit":
          return t.npmAudit(n);
        case "fund":
          return t.npmFund(n);
        case "cache":
          return i[1] === "clean" || i[1] === "clear" ? t.npmCacheClean() : {
            stdout: "",
            stderr: t.formatErr(`cache: unknown subcommand ${i[1] ?? ""}`, "npm"),
            exitCode: 1
          };
        case "whoami":
          return t.npmWhoami(n);
        case "ping":
          return t.npmPing(n);
        case "set-script": {
          const o = i[1], l = i.slice(2).join(" ");
          return !o || !l ? {
            stdout: "",
            stderr: t.formatErr("Usage: npm set-script <name> <command>", "npm"),
            exitCode: 1
          } : t.npmPkg(["set", `scripts.${o}=${l}`], n);
        }
        case "pkg":
          return t.npmPkg(i.slice(1), n);
        default:
          return {
            stdout: "",
            stderr: t.formatErr(`Unknown command "${r}"`, "npm"),
            exitCode: 1
          };
      }
    }
  };
}
var ee = "\x1B[0m", si = "\x1B[1m", le = "\x1B[36m", ii = "\x1B[2m";
function ri(t) {
  return {
    name: "pnpm",
    async execute(e, n) {
      const { silent: s, params: i } = tt(e);
      if (!t.hasFile("/")) return {
        stdout: "",
        stderr: `Volume unavailable
`,
        exitCode: 1
      };
      const r = i[0];
      if (!r || r === "help" || r === "--help") return {
        stdout: `${si}Usage:${ee} pnpm <command>

  ${le}add${ee} [pkg]         Install packages
  ${le}install${ee}           Install from package.json
  ${le}remove${ee} <pkg>      Remove a package
  ${le}run${ee} <script>      Run a script
  ${le}exec${ee} <cmd>        Execute a binary
  ${le}dlx${ee} <pkg>         Download and execute a package

  ${le}list${ee}              List packages
  ${le}init${ee}              Create package.json
  ${le}create${ee} <pkg>      Create a project

${ii}pnpm ${J.PNPM}${ee}
`,
        stderr: "",
        exitCode: 0
      };
      switch (r) {
        case "add":
          return t.installPackages(i.slice(1), n, "pnpm");
        case "install":
        case "i":
          return t.installPackages(i.slice(1), n, "pnpm");
        case "remove":
        case "rm":
        case "uninstall":
        case "un":
          return t.uninstallPackages(i.slice(1), n, "pnpm");
        case "list":
        case "ls":
          return t.listPackages(n, "pnpm");
        case "run":
          return t.runScript([...s, ...i.slice(1)], n);
        case "start":
          return t.runScript([...s, "start"], n);
        case "test":
        case "t":
          return t.runScript([...s, "test"], n);
        case "exec":
          return t.npxExecute(i.slice(1), n);
        case "dlx":
          return t.npxExecute(i.slice(1), n);
        case "init":
        case "create":
          return t.npmInitOrCreate(i.slice(1), r, n);
        case "version":
        case "-v":
        case "--version":
          return {
            stdout: J.PNPM + `
`,
            stderr: "",
            exitCode: 0
          };
        case "audit":
          return t.npmAudit(n);
        case "outdated":
          return t.npmOutdated(n);
        case "why":
          return {
            stdout: "",
            stderr: t.formatErr("why: not available in nodepod", "pnpm"),
            exitCode: 1
          };
        default:
          return t.runScript([...s, ...i], n);
      }
    }
  };
}
var ce = "\x1B[0m", oi = "\x1B[1m", fe = "\x1B[36m";
function ai(t) {
  return {
    name: "yarn",
    async execute(e, n) {
      const { silent: s, params: i } = tt(e);
      if (!t.hasFile("/")) return {
        stdout: "",
        stderr: `Volume unavailable
`,
        exitCode: 1
      };
      const r = i[0];
      if (!r) return t.installPackages([], n, "yarn");
      if (r === "help" || r === "--help") return {
        stdout: `${oi}Usage:${ce} yarn <command>

  ${fe}add${ce} [pkg]         Install packages
  ${fe}install${ce}           Install from package.json
  ${fe}remove${ce} <pkg>      Remove a package
  ${fe}run${ce} <script>      Run a script
  ${fe}exec${ce} <cmd>        Execute a binary
  ${fe}dlx${ce} <pkg>         Download and execute a package
  ${fe}init${ce}              Create package.json
  ${fe}create${ce} <pkg>      Create a project
`,
        stderr: "",
        exitCode: 0
      };
      switch (r) {
        case "add":
          return t.installPackages(i.slice(1), n, "yarn");
        case "install":
        case "i":
          return t.installPackages(i.slice(1), n, "yarn");
        case "remove":
        case "rm":
        case "uninstall":
          return t.uninstallPackages(i.slice(1), n, "yarn");
        case "list":
        case "ls":
          return t.listPackages(n, "yarn");
        case "run":
          return t.runScript([...s, ...i.slice(1)], n);
        case "start":
          return t.runScript([...s, "start"], n);
        case "test":
        case "t":
          return t.runScript([...s, "test"], n);
        case "exec":
          return t.npxExecute(i.slice(1), n);
        case "dlx":
          return t.npxExecute(i.slice(1), n);
        case "init":
        case "create":
          return t.npmInitOrCreate(i.slice(1), r, n);
        case "version":
        case "-v":
        case "--version":
          return {
            stdout: J.YARN + `
`,
            stderr: "",
            exitCode: 0
          };
        case "info":
          return t.npmInfo(i.slice(1), n);
        case "audit":
          return t.npmAudit(n);
        case "outdated":
          return t.npmOutdated(n);
        case "why":
          return {
            stdout: "",
            stderr: t.formatErr("why: not available in nodepod", "yarn"),
            exitCode: 1
          };
        case "global":
          return {
            stdout: "",
            stderr: t.formatErr("global: not available in nodepod", "yarn"),
            exitCode: 1
          };
        default:
          return t.runScript([...s, ...i], n);
      }
    }
  };
}
var pe = "\x1B[0m", li = "\x1B[1m", Ae = "\x1B[36m", ci = "\x1B[2m";
function ui(t) {
  return {
    name: "bun",
    async execute(e, n) {
      const { silent: s, params: i } = tt(e);
      if (!t.hasFile("/")) return {
        stdout: "",
        stderr: `Volume unavailable
`,
        exitCode: 1
      };
      const r = i[0];
      if (!r || r === "help" || r === "--help") return {
        stdout: `${li}Usage:${pe} bun <command>

  ${Ae}run${pe} <script|file> Run a script or file
  ${Ae}install${pe}           Install dependencies
  ${Ae}add${pe} [pkg]         Add a package
  ${Ae}remove${pe} <pkg>      Remove a package
  ${Ae}x${pe} <pkg>           Execute a package
  ${Ae}init${pe}              Create package.json
`,
        stderr: "",
        exitCode: 0
      };
      switch (r) {
        case "run": {
          const o = i[1];
          return o ? /\.(js|mjs|cjs|ts|tsx|jsx)$/.test(o) || o.startsWith("/") ? t.executeNodeBinary(o, i.slice(2), n) : t.runScript([...s, ...i.slice(1)], n) : {
            stdout: "",
            stderr: `error: Missing script or file
`,
            exitCode: 1
          };
        }
        case "start":
          return t.runScript([...s, "start"], n);
        case "test":
        case "t":
          return t.runScript([...s, "test"], n);
        case "install":
        case "i":
          return t.installPackages(i.slice(1), n, "bun");
        case "add":
          return t.installPackages(i.slice(1), n, "bun");
        case "remove":
        case "rm":
          return t.uninstallPackages(i.slice(1), n, "bun");
        case "x":
          return t.npxExecute(i.slice(1), n);
        case "init":
        case "create":
          return t.npmInitOrCreate(i.slice(1), r, n);
        case "pm": {
          const o = i[1];
          return o === "ls" || o === "list" ? t.listPackages(n, "bun") : o === "cache" ? i[2] === "rm" || i[2] === "clear" || i[2] === "clean" ? t.npmCacheClean() : {
            stdout: "",
            stderr: t.formatErr("bun pm cache: use `bun pm cache rm` to clear", "bun"),
            exitCode: 1
          } : {
            stdout: `${ci}bun pm: available subcommands: ls, cache${pe}
`,
            stderr: "",
            exitCode: 0
          };
        }
        case "version":
        case "-v":
        case "--version":
          return {
            stdout: J.BUN + `
`,
            stderr: "",
            exitCode: 0
          };
        case "upgrade":
          return {
            stdout: "",
            stderr: t.formatErr("upgrade: not applicable in nodepod (runtime is embedded)", "bun"),
            exitCode: 1
          };
        case "audit":
          return t.npmAudit(n);
        case "outdated":
          return t.npmOutdated(n);
        default:
          if (i[0] && !i[0].startsWith("-")) {
            const o = i[0].startsWith("/") ? i[0] : `${n.cwd}/${i[0]}`.replace(/\/+/g, "/");
            return t.hasFile(o) ? t.executeNodeBinary(i[0], i.slice(1), n) : t.runScript([...s, ...i], n);
          }
          return {
            stdout: "",
            stderr: `error: unknown command "${r}"
`,
            exitCode: 1
          };
      }
    }
  };
}
function di(t) {
  return {
    name: "bunx",
    async execute(e, n) {
      return t.npxExecute(e, n);
    }
  };
}
var Jt = "\x1B[0m", Zt = "\x1B[1m";
function hi(t) {
  return {
    name: "node",
    async execute(e, n) {
      if (!t.hasFile("/")) return {
        stdout: "",
        stderr: `Volume unavailable
`,
        exitCode: 1
      };
      let s = null, i = null, r = null, o = !1;
      const l = [], a = [];
      let d = !1;
      for (let c = 0; c < e.length; c++) {
        if (d) {
          l.push(e[c]);
          continue;
        }
        if (e[c] === "-e" || e[c] === "--eval") i = e[++c] ?? "";
        else if (e[c] === "-p" || e[c] === "--print") r = e[++c] ?? "";
        else if (e[c] === "--check" || e[c] === "-c") o = !0;
        else {
          if (e[c] === "--version" || e[c] === "-v") return {
            stdout: J.NODE + `
`,
            stderr: "",
            exitCode: 0
          };
          if (e[c] === "--help" || e[c] === "-h") return {
            stdout: `${Zt}Usage:${Jt} node [options] [script.js] [arguments]
`,
            stderr: "",
            exitCode: 0
          };
          e[c] === "--conditions" || e[c] === "-C" ? a.push(e[c], e[++c] ?? "") : e[c] === "-r" || e[c] === "--require" || e[c] === "--experimental-specifier-resolution" || e[c] === "--loader" || e[c] === "--import" ? c++ : e[c].startsWith("-") ? a.push(e[c]) : (s = e[c], d = !0);
        }
      }
      if (i !== null) return t.evalCode(i, n);
      if (r !== null) return t.printCode(r, n);
      if (!s) return {
        stdout: "",
        stderr: `${Zt}Usage:${Jt} node <file> [args...]
`,
        exitCode: 1
      };
      if (o) {
        const c = gt(s, n.cwd);
        let u;
        try {
          u = n.volume.readFileSync(c, "utf8");
        } catch {
          return {
            stdout: "",
            stderr: `node: ${s}: No such file or directory
`,
            exitCode: 1
          };
        }
        const h = n.limits?.maxExpansionBytes ?? 1048576;
        if (u.length > h) return {
          stdout: "",
          stderr: `node: source exceeds ${h} characters
`,
          exitCode: 1
        };
        bs(c) && (u = vs(u, c));
        try {
          return $s(u, void 0, c), {
            stdout: "",
            stderr: "",
            exitCode: 0
          };
        } catch (f) {
          return {
            stdout: "",
            stderr: `${c}
${f instanceof Error ? f.message : String(f)}
`,
            exitCode: 1
          };
        }
      }
      return t.executeNodeBinary(s, l, n, { execArgv: a });
    }
  };
}
function fi(t) {
  return {
    name: "npx",
    async execute(e, n) {
      return t.npxExecute(e, n);
    }
  };
}
var Le = "\x1B[31m", xe = "\x1B[33m", yn = "\x1B[1m";
function wt(t, e, n = 1e5) {
  const s = t.length, i = e.length, r = s + i;
  if (r === 0) return [];
  const o = [], l = /* @__PURE__ */ new Map();
  l.set(1, 0);
  let a = -1, d = 0;
  const c = (p = 1) => {
    if (d += p, d > n) throw new Error(`diff work limit ${n} exceeded`);
  };
  e: for (let p = 0; p <= r; p++) {
    c(l.size), o.push(new Map(l));
    for (let m = -p; m <= p; m += 2) {
      c();
      let g;
      m === -p || m !== p && (l.get(m - 1) ?? 0) < (l.get(m + 1) ?? 0) ? g = l.get(m + 1) ?? 0 : g = (l.get(m - 1) ?? 0) + 1;
      let w = g - m;
      for (; g < s && w < i && t[g] === e[w]; )
        c(), g++, w++;
      if (l.set(m, g), g >= s && w >= i) {
        a = p;
        break e;
      }
    }
  }
  a < 0 && (a = r);
  let u = s, h = i;
  const f = [];
  for (let p = a; p > 0; p--) {
    const m = o[p], g = u - h;
    let w;
    g === -p || g !== p && (m.get(g - 1) ?? 0) < (m.get(g + 1) ?? 0) ? w = g + 1 : w = g - 1;
    const x = m.get(w) ?? 0, v = x - w;
    for (; u > x && h > v; )
      u--, h--, f.push({
        kind: "equal",
        oldIdx: u,
        newIdx: h,
        line: t[u]
      });
    p > 0 && (u === x ? (h--, f.push({
      kind: "insert",
      oldIdx: -1,
      newIdx: h,
      line: e[h]
    })) : (u--, f.push({
      kind: "delete",
      oldIdx: u,
      newIdx: -1,
      line: t[u]
    })));
  }
  for (; u > 0 && h > 0; )
    u--, h--, f.push({
      kind: "equal",
      oldIdx: u,
      newIdx: h,
      line: t[u]
    });
  return f.reverse(), f;
}
function bn(t, e = 3) {
  const n = [];
  if (t.length === 0) return n;
  const s = [];
  for (let l = 0; l < t.length; l++) t[l].kind !== "equal" && s.push(l);
  if (s.length === 0) return n;
  let i = s[0], r = s[0];
  const o = [];
  for (let l = 1; l < s.length; l++) s[l] - r <= e * 2 || (o.push([i, r]), i = s[l]), r = s[l];
  o.push([i, r]);
  for (const [l, a] of o) {
    const d = Math.max(0, l - e), c = Math.min(t.length - 1, a + e), u = t.slice(d, c + 1);
    let h = 1 / 0, f = 1 / 0, p = 0, m = 0;
    for (const g of u) g.kind === "equal" ? (g.oldIdx < h && (h = g.oldIdx), g.newIdx < f && (f = g.newIdx), p++, m++) : g.kind === "delete" ? (g.oldIdx < h && (h = g.oldIdx), p++) : (g.newIdx < f && (f = g.newIdx), m++);
    n.push({
      oldStart: (h === 1 / 0 ? 0 : h) + 1,
      oldCount: p,
      newStart: (f === 1 / 0 ? 0 : f) + 1,
      newCount: m,
      lines: u
    });
  }
  return n;
}
function pi(t) {
  let e = 0, n = 0;
  for (const s of t) s.kind === "insert" ? e++ : s.kind === "delete" && n++;
  return {
    insertions: e,
    deletions: n
  };
}
var ue = class {
  maxFilesystemEntries;
  vol;
  gitDir;
  workDir;
  constructor(t, e, n, s = 1e4) {
    this.maxFilesystemEntries = s, this.vol = t, this.workDir = e, this.gitDir = n;
  }
  readStore() {
    try {
      const t = this.vol.readFileSync(this.gitDir + "/objects/store.json", "utf8");
      return JSON.parse(t);
    } catch {
      return {};
    }
  }
  writeStore(t) {
    this.vol.writeFileSync(this.gitDir + "/objects/store.json", JSON.stringify(t));
  }
  hashContent(t, e) {
    const n = `${t} ${e.length}\0`;
    return Jn("sha1").update(n + e).digest("hex");
  }
  writeObject(t, e) {
    const n = this.hashContent(t, e), s = this.readStore();
    return s[n] || (s[n] = {
      type: t,
      data: e
    }, this.writeStore(s)), n;
  }
  writeObjectAt(t, e, n) {
    const s = this.readStore();
    s[t] = {
      type: e,
      data: n
    }, this.writeStore(s);
  }
  readObject(t) {
    return this.readStore()[t] ?? null;
  }
  isAncestor(t, e) {
    if (!t || !e) return !t;
    if (t === e) return !0;
    const n = /* @__PURE__ */ new Set(), s = [e];
    for (; s.length; ) {
      const i = s.shift();
      if (n.has(i)) continue;
      if (n.add(i), i === t) return !0;
      const r = this.readCommit(i);
      r && (r.parent && s.push(r.parent), r.parent2 && s.push(r.parent2));
    }
    return !1;
  }
  updateRemoteRef(t, e, n) {
    const s = this.gitDir + "/refs/remotes/" + t + "/" + e, i = s.substring(0, s.lastIndexOf("/"));
    this.vol.existsSync(i) || this.vol.mkdirSync(i, { recursive: !0 }), this.vol.writeFileSync(s, n + `
`);
  }
  readIndex() {
    try {
      const t = this.vol.readFileSync(this.gitDir + "/index", "utf8");
      return JSON.parse(t).entries ?? [];
    } catch {
      return [];
    }
  }
  writeIndex(t) {
    this.vol.writeFileSync(this.gitDir + "/index", JSON.stringify({ entries: t }));
  }
  addToIndex(t, e) {
    const n = this.writeObject("blob", e), s = this.readIndex(), i = s.findIndex((o) => o.path === t), r = {
      path: t,
      hash: n,
      mode: 100644,
      mtime: Date.now()
    };
    i >= 0 ? s[i] = r : s.push(r), s.sort((o, l) => o.path.localeCompare(l.path)), this.writeIndex(s);
  }
  removeFromIndex(t) {
    const e = this.readIndex().filter((n) => n.path !== t);
    this.writeIndex(e);
  }
  getHEAD() {
    try {
      return this.vol.readFileSync(this.gitDir + "/HEAD", "utf8").trim();
    } catch {
      return "ref: refs/heads/main";
    }
  }
  setHEAD(t) {
    this.vol.writeFileSync(this.gitDir + "/HEAD", t + `
`);
  }
  getCurrentBranch() {
    const t = this.getHEAD();
    return t.startsWith("ref: refs/heads/") ? t.slice(16) : null;
  }
  resolveRef(t) {
    if (t === "HEAD" || t === "@") return this.resolveHEAD();
    if (/^[0-9a-f]{40}$/i.test(t)) return this.peelToCommit(t.toLowerCase());
    if (t.startsWith("ref: ")) {
      const e = t.slice(5);
      try {
        const n = this.vol.readFileSync(this.gitDir + "/" + e, "utf8").trim();
        return this.peelToCommit(n);
      } catch {
        return null;
      }
    }
    try {
      const e = this.vol.readFileSync(this.gitDir + "/refs/heads/" + t, "utf8").trim();
      return this.peelToCommit(e);
    } catch {
    }
    try {
      const e = this.vol.readFileSync(this.gitDir + "/refs/tags/" + t, "utf8").trim();
      return this.peelToCommit(e);
    } catch {
    }
    if (/^[0-9a-f]{4,39}$/i.test(t)) {
      const e = this.readStore(), n = Object.keys(e).filter((s) => s.startsWith(t.toLowerCase()) && e[s].type === "commit");
      if (n.length === 1) return n[0];
      if (n.length === 0) {
        const s = Object.keys(e).filter((i) => i.startsWith(t.toLowerCase()));
        if (s.length === 1) return this.peelToCommit(s[0]);
      }
    }
    return null;
  }
  peelToCommit(t) {
    const e = this.readObject(t);
    if (!e) return null;
    if (e.type === "commit") return t;
    if (e.type === "tag") try {
      const n = JSON.parse(e.data);
      return this.peelToCommit(n.object);
    } catch {
      return null;
    }
    return null;
  }
  resolveHEAD() {
    return this.resolveRef(this.getHEAD());
  }
  updateBranchRef(t, e) {
    const n = this.gitDir + "/refs/heads/" + t, s = n.substring(0, n.lastIndexOf("/"));
    this.vol.existsSync(s) || this.vol.mkdirSync(s, { recursive: !0 }), this.vol.writeFileSync(n, e + `
`);
  }
  listBranches() {
    try {
      return this.vol.readdirSync(this.gitDir + "/refs/heads");
    } catch {
      return [];
    }
  }
  deleteBranch(t) {
    try {
      const e = this.gitDir + "/refs/heads/" + t;
      if (this.vol.existsSync(e))
        return this.vol.unlinkSync(e), !0;
    } catch {
    }
    return !1;
  }
  readConfig() {
    try {
      return this.vol.readFileSync(this.gitDir + "/config", "utf8");
    } catch {
      return "";
    }
  }
  writeConfig(t) {
    this.vol.writeFileSync(this.gitDir + "/config", t);
  }
  getConfigValue(t) {
    const e = this.readConfig(), n = t.split(".");
    if (n.length < 2) return null;
    let s, i = null, r;
    n.length === 3 ? (s = n[0], i = n[1], r = n[2]) : (s = n[0], r = n[1]);
    const o = e.split(`
`);
    let l = !1;
    for (const a of o) {
      const d = a.trim();
      if (d.startsWith("[")) {
        i ? l = d === `[${s} "${i}"]` : l = d === `[${s}]`;
        continue;
      }
      if (l) {
        const c = d.match(/^(\w+)\s*=\s*(.*)$/);
        if (c && c[1] === r) return c[2].trim();
      }
    }
    return null;
  }
  setConfigValue(t, e) {
    const n = t.split(".");
    let s, i;
    if (n.length === 3)
      s = `[${n[0]} "${n[1]}"]`, i = n[2];
    else if (n.length === 2)
      s = `[${n[0]}]`, i = n[1];
    else return;
    const r = this.readConfig().split(`
`);
    let o = -1, l = -1, a = !1, d = -1;
    for (let c = 0; c < r.length; c++) {
      const u = r[c].trim();
      if (u.startsWith("[")) {
        a && l === -1 && (d = c - 1), a = u === s, a && (o = c);
        continue;
      }
      if (a) {
        d = c;
        const h = u.match(/^(\w+)\s*=\s*(.*)$/);
        h && h[1] === i && (l = c);
      }
    }
    a && d === -1 && (d = o), l >= 0 ? r[l] = `	${i} = ${e}` : o >= 0 ? r.splice(d + 1, 0, `	${i} = ${e}`) : (r.length > 0 && r[r.length - 1] !== "" && r.push(""), r.push(s), r.push(`	${i} = ${e}`)), this.writeConfig(r.join(`
`));
  }
  buildTree(t) {
    const e = [], n = /* @__PURE__ */ new Map();
    for (const i of t) {
      const r = i.path.indexOf("/");
      if (r === -1) e.push({
        name: i.path,
        mode: String(i.mode),
        type: "blob",
        hash: i.hash
      });
      else {
        const o = i.path.substring(0, r), l = {
          ...i,
          path: i.path.substring(r + 1)
        };
        n.has(o) || n.set(o, []), n.get(o).push(l);
      }
    }
    for (const [i, r] of n) {
      const o = this.buildTree(r);
      e.push({
        name: i,
        mode: "40000",
        type: "tree",
        hash: o
      });
    }
    e.sort((i, r) => i.name.localeCompare(r.name));
    const s = JSON.stringify(e);
    return this.writeObject("tree", s);
  }
  createCommit(t, e, n, s) {
    const i = `${this.getConfigValue("user.name") ?? "nodepod-user"} <${this.getConfigValue("user.email") ?? "user@nodepod.dev"}>`, r = {
      tree: n,
      parent: e,
      author: i,
      committer: i,
      timestamp: Date.now(),
      message: t
    };
    return s && (r.parent2 = s), this.writeObject("commit", JSON.stringify(r));
  }
  readCommit(t) {
    const e = this.readObject(t);
    return !e || e.type !== "commit" ? null : JSON.parse(e.data);
  }
  walkLog(t, e) {
    const n = [];
    let s = t;
    for (; s && n.length < e; ) {
      const i = this.readCommit(s);
      if (!i) break;
      n.push({
        hash: s,
        ...i
      }), s = i.parent;
    }
    return n;
  }
  getCommitTree(t) {
    const e = this.readCommit(t);
    return e ? this.flattenTree(e.tree, "") : /* @__PURE__ */ new Map();
  }
  flattenTree(t, e) {
    const n = this.readObject(t);
    if (!n || n.type !== "tree") return /* @__PURE__ */ new Map();
    const s = JSON.parse(n.data), i = /* @__PURE__ */ new Map();
    for (const r of s) {
      const o = e ? e + "/" + r.name : r.name;
      if (r.type === "blob") i.set(o, r.hash);
      else for (const [l, a] of this.flattenTree(r.hash, o)) i.set(l, a);
    }
    return i;
  }
  getBlobContent(t) {
    const e = this.readObject(t);
    return !e || e.type !== "blob" ? null : e.data;
  }
  checkoutTree(t, e) {
    const n = this.readIndex();
    for (const i of n) if (!t.has(i.path)) {
      const r = this.workDir + "/" + i.path;
      try {
        e.existsSync(r) && e.unlinkSync(r);
      } catch {
      }
    }
    const s = [];
    for (const [i, r] of t) {
      const o = this.getBlobContent(r);
      if (o === null) continue;
      const l = this.workDir + "/" + i, a = l.substring(0, l.lastIndexOf("/"));
      a && !e.existsSync(a) && e.mkdirSync(a, { recursive: !0 }), e.writeFileSync(l, o), s.push({
        path: i,
        hash: r,
        mode: 100644,
        mtime: Date.now()
      });
    }
    s.sort((i, r) => i.path.localeCompare(r.path)), this.writeIndex(s);
  }
  findMergeBase(t, e) {
    const n = /* @__PURE__ */ new Set();
    let s = t;
    for (let i = 0; i < 5e3 && s; i++) {
      n.add(s);
      const r = this.readCommit(s);
      if (!r) break;
      s = r.parent;
    }
    s = e;
    for (let i = 0; i < 5e3 && s; i++) {
      if (n.has(s)) return s;
      const r = this.readCommit(s);
      if (!r) break;
      s = r.parent;
    }
    return null;
  }
  listTags() {
    try {
      return this.vol.readdirSync(this.gitDir + "/refs/tags");
    } catch {
      return [];
    }
  }
  updateTagRef(t, e) {
    const n = this.gitDir + "/refs/tags/" + t, s = n.substring(0, n.lastIndexOf("/"));
    this.vol.existsSync(s) || this.vol.mkdirSync(s, { recursive: !0 }), this.vol.writeFileSync(n, e + `
`);
  }
  deleteTag(t) {
    try {
      const e = this.gitDir + "/refs/tags/" + t;
      if (this.vol.existsSync(e))
        return this.vol.unlinkSync(e), !0;
    } catch {
    }
    return !1;
  }
  writeAnnotatedTag(t, e, n) {
    const s = `${this.getConfigValue("user.name") ?? "nodepod-user"} <${this.getConfigValue("user.email") ?? "user@nodepod.dev"}>`, i = JSON.stringify({
      object: e,
      type: "commit",
      tag: t,
      tagger: s,
      timestamp: Date.now(),
      message: n
    });
    return this.writeObject("tag", i);
  }
  diffWorkingVsIndex() {
    const t = this.readIndex(), e = new Map(t.map((i) => [i.path, i.hash])), n = [], s = /* @__PURE__ */ new Set();
    this.walkWorkTree(this.workDir, "", (i, r) => {
      s.add(i);
      const o = this.hashContent("blob", r), l = e.get(i);
      l && o !== l && n.push({
        path: i,
        status: "modified",
        oldContent: this.getBlobContent(l) ?? "",
        newContent: r
      });
    });
    for (const i of t) s.has(i.path) || n.push({
      path: i.path,
      status: "deleted",
      oldContent: this.getBlobContent(i.hash) ?? ""
    });
    return n;
  }
  diffIndexVsHEAD() {
    const t = this.readIndex(), e = this.resolveHEAD(), n = e ? this.getCommitTree(e) : /* @__PURE__ */ new Map(), s = [], i = new Map(t.map((r) => [r.path, r.hash]));
    for (const r of t) {
      const o = n.get(r.path);
      o ? o !== r.hash && s.push({
        path: r.path,
        status: "modified"
      }) : s.push({
        path: r.path,
        status: "added"
      });
    }
    for (const [r] of n) i.has(r) || s.push({
      path: r,
      status: "deleted"
    });
    return s;
  }
  getUntrackedFiles() {
    const t = this.readIndex(), e = new Set(t.map((s) => s.path)), n = [];
    return this.walkWorkTree(this.workDir, "", (s) => {
      e.has(s) || n.push(s);
    }), n.sort();
  }
  walkWorkTree(t, e, n, s = { entries: 0 }) {
    const i = [{
      dir: t,
      prefix: e
    }];
    for (; i.length > 0; ) {
      const r = i.pop();
      let o;
      try {
        o = this.vol.readdirSync(r.dir);
      } catch {
        continue;
      }
      for (const l of o) {
        if (l === ".git" || l === "node_modules") continue;
        if (++s.entries > this.maxFilesystemEntries) throw new Error(`filesystem entry limit ${this.maxFilesystemEntries} exceeded`);
        const a = r.dir + "/" + l;
        let d;
        try {
          d = this.vol.lstatSync(a);
        } catch {
          continue;
        }
        const c = r.prefix ? r.prefix + "/" + l : l;
        if (d.isDirectory()) i.push({
          dir: a,
          prefix: c
        });
        else if (d.isFile()) {
          let u;
          try {
            u = this.vol.readFileSync(a, "utf8");
          } catch {
            continue;
          }
          n(c, u);
        }
      }
    }
  }
  readStashList() {
    try {
      const t = this.vol.readFileSync(this.gitDir + "/refs/stash", "utf8");
      return JSON.parse(t);
    } catch {
      return [];
    }
  }
  writeStashList(t) {
    const e = this.gitDir + "/refs";
    this.vol.existsSync(e) || this.vol.mkdirSync(e, { recursive: !0 }), this.vol.writeFileSync(this.gitDir + "/refs/stash", JSON.stringify(t));
  }
  getRemoteUrl(t) {
    return this.getConfigValue(`remote.${t}.url`);
  }
  parseGitHubUrl(t) {
    let e = t.match(/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/);
    return e ? {
      owner: e[1],
      repo: e[2]
    } : (e = t.match(/github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/), e ? {
      owner: e[1],
      repo: e[2]
    } : null);
  }
};
async function mi(t, e, n = "GET", s, i, r = 4194304) {
  const o = `https://api.github.com${t}`, l = {
    Accept: "application/vnd.github.v3+json",
    Authorization: `token ${e}`,
    "User-Agent": "nodepod-git"
  }, a = s ? JSON.stringify(s) : void 0;
  if (a && a.length > r) throw new Error(`GitHub request exceeds ${r} bytes`);
  a && (l["Content-Type"] = "application/json");
  const d = new AbortController(), c = () => d.abort(i?.reason);
  i?.aborted ? c() : i?.addEventListener("abort", c, { once: !0 });
  const u = setTimeout(() => d.abort(/* @__PURE__ */ new Error("GitHub request timed out")), 3e4);
  try {
    const h = await Cs(o, {
      method: n,
      headers: l,
      body: a,
      signal: d.signal
    }), f = Number(h.headers?.get?.("content-length") ?? 0);
    if (Number.isFinite(f) && f > r) throw new Error(`GitHub response exceeds ${r} bytes`);
    let p;
    try {
      if (h.body?.getReader) {
        const m = h.body.getReader(), g = new TextDecoder();
        let w = "", x = 0;
        for (; ; ) {
          const v = await m.read();
          if (v.done) break;
          if (x += v.value.byteLength, x > r)
            throw await m.cancel(), new Error(`GitHub response exceeds ${r} bytes`);
          w += g.decode(v.value, { stream: !0 });
        }
        w += g.decode(), p = w ? JSON.parse(w) : null;
      } else if (typeof h.text == "function") {
        const m = await h.text();
        if (m.length > r) throw new Error(`GitHub response exceeds ${r} bytes`);
        p = m ? JSON.parse(m) : null;
      } else p = await h.json();
    } catch (m) {
      if (d.signal.aborted) throw d.signal.reason;
      if (m instanceof Error && m.message.includes("response exceeds")) throw m;
      p = null;
    }
    return {
      ok: h.ok,
      status: h.status,
      data: p
    };
  } finally {
    clearTimeout(u), i?.removeEventListener("abort", c);
  }
}
function St(t) {
  return typeof t != "string" || t.length === 0 || t.startsWith("/") || t.includes("\0") ? !1 : t.split("/").every((e) => e.length > 0 && e !== "." && e !== "..");
}
function nt(t) {
  return (e, n, s = "GET", i) => mi(e, n, s, i, t.signal, t.limits?.maxOutputBytes ?? 4194304);
}
function Et(t, e) {
  let n = e;
  for (; ; ) {
    const s = n + "/.git";
    try {
      if (t.existsSync(s)) return {
        gitDir: s,
        workDir: n
      };
    } catch {
    }
    const i = n.substring(0, n.lastIndexOf("/")) || "/";
    if (i === n) break;
    n = i;
  }
  return t.existsSync("/.git") ? {
    gitDir: "/.git",
    workDir: "/"
  } : null;
}
function j(t, e) {
  const n = Et(t, e);
  return n ? { repo: new ue(t, n.workDir, n.gitDir) } : { error: b(`fatal: not a git repository (or any of the parent directories): .git
`, 128) };
}
function $n(t, e) {
  let n = e.cwd;
  for (const r of t) if (!r.startsWith("-")) {
    n = we(e.cwd, r);
    break;
  }
  const s = n + "/.git";
  if (e.volume.existsSync(s)) return C(`Reinitialized existing Git repository in ${s}/
`);
  const i = [
    s,
    s + "/objects",
    s + "/refs",
    s + "/refs/heads",
    s + "/refs/tags"
  ];
  for (const r of i) e.volume.existsSync(r) || e.volume.mkdirSync(r, { recursive: !0 });
  return e.volume.writeFileSync(s + "/HEAD", `ref: refs/heads/main
`), e.volume.writeFileSync(s + "/config", `[core]
	bare = false
	filemode = false
[user]
	name = nodepod-user
	email = user@nodepod.dev
`), e.volume.writeFileSync(s + "/objects/store.json", "{}"), e.volume.writeFileSync(s + "/index", '{"entries":[]}'), e.volume.existsSync(n) || e.volume.mkdirSync(n, { recursive: !0 }), C(`Initialized empty Git repository in ${s}/
`);
}
function gi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("-A") || t.includes("--all") || t.includes("."), r = i ? [] : t.filter((o) => !o.startsWith("-"));
  if (!i && r.length === 0) return b(`Nothing specified, nothing added.
`);
  if (i) {
    s.walkWorkTree(s.workDir, "", (a, d) => {
      s.addToIndex(a, d);
    });
    const o = s.readIndex(), l = [];
    for (const a of o) {
      const d = s.workDir + "/" + a.path;
      e.volume.existsSync(d) || l.push(a.path);
    }
    for (const a of l) s.removeFromIndex(a);
  } else for (const o of r) {
    const l = we(e.cwd, o), a = Me(s.workDir, l);
    if (!a.startsWith(".."))
      if (e.volume.existsSync(l)) try {
        if (e.volume.statSync(l).isDirectory()) s.walkWorkTree(l, a, (d, c) => {
          s.addToIndex(d, c);
        });
        else {
          const d = e.volume.readFileSync(l, "utf8");
          s.addToIndex(a, d);
        }
      } catch {
      }
      else s.removeFromIndex(a);
  }
  return C("");
}
function wi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("-s") || t.includes("--short"), r = t.includes("--porcelain"), o = s.diffIndexVsHEAD(), l = s.diffWorkingVsIndex(), a = s.getUntrackedFiles();
  if (i || r) {
    let c = "";
    for (const u of o) {
      const h = u.status === "added" ? "A" : u.status === "deleted" ? "D" : "M";
      c += `${h}  ${u.path}
`;
    }
    for (const u of l) {
      const h = u.status === "deleted" ? "D" : "M";
      c += ` ${h} ${u.path}
`;
    }
    for (const u of a) c += `?? ${u}
`;
    return C(c);
  }
  let d = `On branch ${s.getCurrentBranch() ?? "(HEAD detached)"}
`;
  if (o.length === 0 && l.length === 0 && a.length === 0)
    return d += `nothing to commit, working tree clean
`, C(d);
  if (o.length > 0) {
    d += `
Changes to be committed:
`, d += `  (use "git restore --staged <file>..." to unstage)
`;
    for (const c of o) {
      const u = c.status === "added" ? "new file" : c.status === "deleted" ? "deleted" : "modified";
      d += `	${_e}${u}:   ${c.path}${q}
`;
    }
  }
  if (l.length > 0) {
    d += `
Changes not staged for commit:
`, d += `  (use "git add <file>..." to update what will be committed)
`;
    for (const c of l) {
      const u = c.status === "deleted" ? "deleted" : "modified";
      d += `	${Le}${u}:   ${c.path}${q}
`;
    }
  }
  if (a.length > 0) {
    d += `
Untracked files:
`, d += `  (use "git add <file>..." to include in what will be committed)
`;
    for (const c of a) d += `	${Le}${c}${q}
`;
  }
  return C(d);
}
function vi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  let i = null, r = !1, o = !1;
  for (let m = 0; m < t.length; m++) t[m] === "-m" || t[m] === "--message" ? i = t[++m] ?? "" : t[m] === "-a" || t[m] === "--all" ? r = !0 : t[m] === "--allow-empty" ? o = !0 : t[m] === "--allow-empty-message" || t[m].startsWith("-m") && (i = t[m].slice(2));
  if (i === null) return b("error: switch `m' requires a value\n");
  if (r) {
    const m = s.readIndex();
    for (const g of m) {
      const w = s.workDir + "/" + g.path;
      if (e.volume.existsSync(w)) try {
        const x = e.volume.readFileSync(w, "utf8");
        s.addToIndex(g.path, x);
      } catch {
      }
      else s.removeFromIndex(g.path);
    }
  }
  const l = s.readIndex(), a = s.diffIndexVsHEAD();
  if (a.length === 0 && !o) return b(`nothing to commit, working tree clean
`);
  const d = s.buildTree(l), c = s.resolveHEAD(), u = s.createCommit(i, c, d), h = s.getCurrentBranch();
  h ? s.updateBranchRef(h, u) : s.setHEAD(u);
  const f = u.slice(0, 7), p = `[${h ?? "HEAD"}${c ? "" : " (root-commit)"} ${f}] ${i}
 ${a.length} file${a.length !== 1 ? "s" : ""} changed
`;
  return C(p);
}
function yi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  let i = 50, r = !1, o = null;
  for (let u = 0; u < t.length; u++) t[u] === "--oneline" ? r = !0 : t[u] === "-n" || t[u] === "--max-count" ? i = parseInt(t[++u], 10) || 50 : t[u].startsWith("-") && /^-\d+$/.test(t[u]) ? i = parseInt(t[u].slice(1), 10) || 50 : t[u].startsWith("--format=") ? o = t[u].slice(9) : t[u].startsWith("--pretty=format:") ? o = t[u].slice(16) : t[u].startsWith("--pretty=") && (o = t[u].slice(9));
  const l = s.resolveHEAD();
  if (!l) return C("");
  const a = s.walkLog(l, i);
  if (a.length === 0) return C("");
  const d = s.getCurrentBranch();
  let c = "";
  for (const u of a) if (o !== null) {
    let h = o.replace(/%H/g, u.hash).replace(/%h/g, u.hash.slice(0, 7)).replace(/%s/g, u.message.split(`
`)[0]).replace(/%an/g, u.author.split(" <")[0]).replace(/%ae/g, (u.author.match(/<(.+?)>/) ?? ["", ""])[1]).replace(/%d/g, u.hash === l && d ? ` (HEAD -> ${d})` : "").replace(/%n/g, `
`);
    c += h + `
`;
  } else if (r) {
    const h = u.hash === l && d ? ` ${xe}(HEAD -> ${Je}${d}${xe})${q}` : "";
    c += `${xe}${u.hash.slice(0, 7)}${q}${h} ${u.message.split(`
`)[0]}
`;
  } else {
    const h = u.hash === l && d ? ` ${xe}(HEAD -> ${Je}${d}${xe})${q}` : "";
    c += `${xe}commit ${u.hash}${q}${h}
`, c += `Author: ${u.author}
`, c += `Date:   ${new Date(u.timestamp).toUTCString()}
`, c += `
    ${u.message}

`;
  }
  return C(c);
}
function bi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("--staged") || t.includes("--cached"), r = t.includes("--stat");
  let o;
  if (i) {
    o = s.diffIndexVsHEAD();
    const a = s.resolveHEAD(), d = a ? s.getCommitTree(a) : /* @__PURE__ */ new Map(), c = s.readIndex(), u = new Map(c.map((h) => [h.path, h.hash]));
    for (const h of o) {
      const f = d.get(h.path), p = u.get(h.path);
      h.oldContent = f ? s.getBlobContent(f) ?? "" : "", h.newContent = p ? s.getBlobContent(p) ?? "" : "";
    }
  } else o = s.diffWorkingVsIndex();
  if (o.length === 0) return C("");
  if (r) {
    let a = "", d = 0, c = 0;
    for (const u of o) {
      const { insertions: h, deletions: f } = pi(wt(u.oldContent ? u.oldContent.split(`
`) : [], u.newContent ? u.newContent.split(`
`) : [], e.limits?.maxLoopIterations));
      d += h, c += f, a += ` ${u.path} | ${h + f} ${_e}${"+".repeat(h)}${Le}${"-".repeat(f)}${q}
`;
    }
    return a += ` ${o.length} file${o.length !== 1 ? "s" : ""} changed`, d > 0 && (a += `, ${d} insertion${d !== 1 ? "s" : ""}(+)`), c > 0 && (a += `, ${c} deletion${c !== 1 ? "s" : ""}(-)`), a += `
`, C(a);
  }
  let l = "";
  for (const a of o) {
    const d = a.oldContent ? a.oldContent.split(`
`) : [], c = a.newContent ? a.newContent.split(`
`) : [];
    l += `${yn}diff --git a/${a.path} b/${a.path}${q}
`, a.status === "added" && (l += `new file mode 100644
`), a.status === "deleted" && (l += `deleted file mode 100644
`), l += `--- ${a.status === "added" ? "/dev/null" : "a/" + a.path}
`, l += `+++ ${a.status === "deleted" ? "/dev/null" : "b/" + a.path}
`;
    const u = bn(wt(d, c, e.limits?.maxLoopIterations), 3);
    for (const h of u) {
      l += `${Je}@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@${q}
`;
      for (const f of h.lines) f.kind === "equal" ? l += ` ${f.line}
` : f.kind === "delete" ? l += `${Le}-${f.line}${q}
` : l += `${_e}+${f.line}${q}
`;
    }
  }
  return C(l);
}
function $i(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  if (t.includes("--show-current")) {
    const c = s.getCurrentBranch();
    return C(c ? c + `
` : `
`);
  }
  const i = t.indexOf("-d") !== -1 ? t.indexOf("-d") : t.indexOf("-D");
  if (i >= 0) {
    const c = t[i + 1];
    return c ? c === s.getCurrentBranch() ? b(`error: Cannot delete branch '${c}' checked out.
`) : s.deleteBranch(c) ? C(`Deleted branch ${c}.
`) : b(`error: branch '${c}' not found.
`) : b(`error: branch name required
`);
  }
  const r = t.indexOf("-m");
  if (r >= 0) {
    const c = t[r + 1], u = t[r + 2];
    if (!c || !u) return b(`error: too few arguments to rename
`);
    const h = s.resolveRef(c);
    return h ? (s.updateBranchRef(u, h), s.deleteBranch(c), s.getCurrentBranch() === c && s.setHEAD("ref: refs/heads/" + u), C(`Branch '${c}' renamed to '${u}'.
`)) : b(`error: refname ${c} not a valid ref
`);
  }
  const o = t.filter((c) => !c.startsWith("-"));
  if (o.length > 0) {
    const c = o[0], u = o[1], h = u ? s.resolveRef(u) : s.resolveHEAD();
    return h ? (s.updateBranchRef(c, h), C("")) : b(`fatal: not a valid object name: '${u ?? "HEAD"}'
`, 128);
  }
  const l = s.listBranches(), a = s.getCurrentBranch();
  let d = "";
  for (const c of l.sort()) c === a ? d += `* ${_e}${c}${q}
` : d += `  ${c}
`;
  return C(d);
}
function xn(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("-b"), r = t.filter((u) => !u.startsWith("-"));
  if (r.length === 0) return b(`error: you must specify a branch to checkout
`);
  let o, l = null;
  if (i) {
    const u = t.indexOf("-b");
    if (l = t[u + 1], !l) return b(`error: switch 'b' requires a value
`);
    o = t[u + 2] ?? s.getCurrentBranch() ?? "HEAD";
  } else o = r[0];
  let a = s.resolveRef(o);
  if (i)
    return a || (a = s.resolveHEAD()), a ? (s.updateBranchRef(l, a), s.setHEAD("ref: refs/heads/" + l), C(`Switched to a new branch '${l}'
`)) : b(`fatal: not a valid object name: '${o}'
`, 128);
  const d = s.listBranches().includes(o);
  if (!a) return b(`error: pathspec '${o}' did not match any file(s) known to git.
`);
  const c = s.resolveHEAD();
  if (a !== c) {
    const u = s.getCommitTree(a), h = c ? s.getCommitTree(c) : /* @__PURE__ */ new Map();
    for (const [p, m] of u) {
      const g = s.getBlobContent(m);
      if (g !== null) {
        const w = s.workDir + "/" + p, x = w.substring(0, w.lastIndexOf("/"));
        x && !e.volume.existsSync(x) && e.volume.mkdirSync(x, { recursive: !0 }), e.volume.writeFileSync(w, g);
      }
    }
    for (const [p] of h) if (!u.has(p)) {
      const m = s.workDir + "/" + p;
      try {
        e.volume.unlinkSync(m);
      } catch {
      }
    }
    const f = [];
    for (const [p, m] of u) f.push({
      path: p,
      hash: m,
      mode: 100644,
      mtime: Date.now()
    });
    f.sort((p, m) => p.path.localeCompare(m.path)), s.writeIndex(f);
  }
  return d ? (s.setHEAD("ref: refs/heads/" + o), C(`Switched to branch '${o}'
`)) : (s.setHEAD(a), C(`HEAD is now at ${a.slice(0, 7)}
`));
}
function xi(t, e) {
  const n = [];
  for (let s = 0; s < t.length; s++) t[s] === "-c" || t[s] === "--create" ? n.push("-b") : n.push(t[s]);
  return xn(n, e);
}
function Ci(t, e) {
  const n = Et(e.volume, e.cwd);
  for (const i of t) switch (i) {
    case "--show-toplevel":
      return n ? C(n.workDir + `
`) : b(`fatal: not a git repository
`, 128);
    case "--is-inside-work-tree":
      return C(n ? `true
` : `false
`);
    case "--git-dir":
      return n ? C(`.git
`) : b(`fatal: not a git repository
`, 128);
    case "--is-bare-repository":
      return C(`false
`);
    case "--abbrev-ref":
      if (t[t.indexOf(i) + 1] === "HEAD" && n) {
        const r = new ue(e.volume, n.workDir, n.gitDir).getCurrentBranch();
        return C((r ?? "HEAD") + `
`);
      }
      return C(`HEAD
`);
    case "--short":
      if (t[t.indexOf(i) + 1] === "HEAD" && n) {
        const r = new ue(e.volume, n.workDir, n.gitDir).resolveHEAD();
        return C(r ? r.slice(0, 7) + `
` : `
`);
      }
      return C(`
`);
    case "--verify": {
      const r = t[t.indexOf(i) + 1];
      if (!n) return b(`fatal: not a git repository
`, 128);
      const o = new ue(e.volume, n.workDir, n.gitDir);
      if (r === "HEAD") {
        const a = o.resolveHEAD();
        return a ? C(a + `
`) : b(`fatal: Needed a single revision
`, 128);
      }
      const l = o.resolveRef(r ?? "");
      return l ? C(l + `
`) : b(`fatal: Needed a single revision
`, 128);
    }
  }
  const s = t.filter((i) => !i.startsWith("-"));
  if (s.length > 0 && n) {
    const i = new ue(e.volume, n.workDir, n.gitDir);
    for (const r of s) if (r === "HEAD") {
      const o = i.resolveHEAD();
      if (o) return C(o + `
`);
    } else {
      const o = i.resolveRef(r);
      if (o) return C(o + `
`);
    }
  }
  return C(`
`);
}
function ki(t, e) {
  const n = Et(e.volume, e.cwd);
  if (t.includes("--list") || t.includes("-l")) {
    if (!n) return b(`fatal: not a git repository
`, 128);
    const a = new ue(e.volume, n.workDir, n.gitDir).readConfig().split(`
`);
    let d = "", c = "", u = "";
    for (const h of a) {
      const f = h.trim(), p = f.match(/^\[(\w+)\s*(?:"([^"]*)")?\]$/);
      if (p) {
        d = p[1], c = p[2] ?? "";
        continue;
      }
      const m = f.match(/^(\w+)\s*=\s*(.*)$/);
      if (m && d) {
        const g = c ? `${d}.${c}.${m[1]}` : `${d}.${m[1]}`;
        u += `${g}=${m[2].trim()}
`;
      }
    }
    return C(u);
  }
  const s = t.filter((a) => a !== "--global" && a !== "--local" && a !== "--get");
  if (s.length === 0) return b(`error: key required
`);
  const i = s[0], r = s[1];
  if (!n)
    return r !== void 0 ? b(`fatal: not a git repository
`, 128) : C(`
`);
  const o = new ue(e.volume, n.workDir, n.gitDir);
  if (r !== void 0)
    return o.setConfigValue(i, r), C("");
  const l = o.getConfigValue(i);
  return l !== null ? C(l + `
`) : b("");
}
function Si(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t[0];
  if (i === "add") {
    const u = t[1], h = t[2];
    return !u || !h ? b(`usage: git remote add <name> <url>
`) : (s.setConfigValue(`remote.${u}.url`, h), s.setConfigValue(`remote.${u}.fetch`, `+refs/heads/*:refs/remotes/${u}/*`), C(""));
  }
  if (i === "remove" || i === "rm") {
    const u = t[1];
    if (!u) return b(`usage: git remote remove <name>
`);
    const h = s.readConfig().split(`
`), f = [];
    let p = !1;
    for (const m of h) {
      if (m.trim() === `[remote "${u}"]`) {
        p = !0;
        continue;
      }
      m.trim().startsWith("[") && p && (p = !1), p || f.push(m);
    }
    return s.writeConfig(f.join(`
`)), C("");
  }
  if (i === "get-url") {
    const u = t[1] ?? "origin", h = s.getRemoteUrl(u);
    return h ? C(h + `
`) : b(`fatal: No such remote '${u}'
`, 2);
  }
  const r = t.includes("-v") || t.includes("--verbose"), o = s.readConfig(), l = [], a = o.split(`
`);
  let d = "";
  for (const u of a) {
    const h = u.trim().match(/^\[remote\s+"([^"]+)"\]$/);
    if (h) {
      d = h[1];
      continue;
    }
    if (d) {
      const f = u.trim().match(/^url\s*=\s*(.+)$/);
      f && (l.push({
        name: d,
        url: f[1].trim()
      }), d = "");
    }
  }
  let c = "";
  for (const u of l) r ? (c += `${u.name}	${u.url} (fetch)
`, c += `${u.name}	${u.url} (push)
`) : c += u.name + `
`;
  return C(c);
}
function Ei(t, e, n) {
  if (e === n) return {
    content: e ?? "",
    conflict: !1
  };
  if (t === e) return {
    content: n ?? "",
    conflict: !1
  };
  if (t === n) return {
    content: e ?? "",
    conflict: !1
  };
  const s = e ?? "", i = n ?? "";
  return {
    content: `<<<<<<< HEAD
${s}${s.endsWith(`
`) || s === "" ? "" : `
`}=======
${i}${i.endsWith(`
`) || i === "" ? "" : `
`}>>>>>>> theirs
`,
    conflict: !0
  };
}
function st(t, e, n, s, i) {
  const r = /* @__PURE__ */ new Set([
    ...n.keys(),
    ...s.keys(),
    ...i.keys()
  ]), o = /* @__PURE__ */ new Map(), l = [], a = (c, u) => {
    const h = t.getBlobContent(u);
    if (h === null) return;
    const f = t.workDir + "/" + c, p = f.substring(0, f.lastIndexOf("/"));
    p && !e.existsSync(p) && e.mkdirSync(p, { recursive: !0 }), e.writeFileSync(f, h);
  };
  for (const c of r) {
    const u = n.get(c) ?? null, h = s.get(c) ?? null, f = i.get(c) ?? null, p = u ? t.getBlobContent(u) : null, m = h ? t.getBlobContent(h) : null, g = f ? t.getBlobContent(f) : null;
    if (h === f) {
      h && (o.set(c, h), a(c, h));
      continue;
    }
    if (h === u && f) {
      o.set(c, f), a(c, f);
      continue;
    }
    if (f === u && h) {
      o.set(c, h), a(c, h);
      continue;
    }
    if (!h && !f) continue;
    const w = Ei(p, m, g);
    if (w.conflict) {
      l.push(c);
      const x = t.workDir + "/" + c, v = x.substring(0, x.lastIndexOf("/"));
      v && !e.existsSync(v) && e.mkdirSync(v, { recursive: !0 }), e.writeFileSync(x, w.content);
      const $ = t.writeObject("blob", w.content);
      o.set(c, $);
    } else if (!(w.content === "" && !h && !f)) {
      const x = t.writeObject("blob", w.content);
      o.set(c, x);
      const v = t.workDir + "/" + c, $ = v.substring(0, v.lastIndexOf("/"));
      $ && !e.existsSync($) && e.mkdirSync($, { recursive: !0 }), e.writeFileSync(v, w.content);
    }
  }
  const d = [];
  for (const [c, u] of o) d.push({
    path: c,
    hash: u,
    mode: 100644,
    mtime: Date.now()
  });
  d.sort((c, u) => c.path.localeCompare(u.path)), t.writeIndex(d);
  for (const c of n.keys()) if (!o.has(c) && !l.includes(c)) {
    const u = t.workDir + "/" + c;
    try {
      e.existsSync(u) && e.unlinkSync(u);
    } catch {
    }
  }
  return {
    conflicts: l,
    merged: o
  };
}
function Di(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  if (t.includes("--abort")) {
    try {
      e.volume.readFileSync(s.gitDir + "/MERGE_HEAD", "utf8").trim();
      const v = s.resolveHEAD();
      v && s.checkoutTree(s.getCommitTree(v), e.volume), e.volume.unlinkSync(s.gitDir + "/MERGE_HEAD");
      try {
        e.volume.unlinkSync(s.gitDir + "/MERGE_MSG");
      } catch {
      }
    } catch {
      return b(`fatal: There is no merge to abort
`, 128);
    }
    return C(`Merge aborted.
`);
  }
  const i = t.filter((v) => !v.startsWith("-"))[0];
  if (!i) return b(`error: specify a branch to merge
`);
  const r = s.resolveRef(i);
  if (!r) return b(`merge: ${i} - not something we can merge
`);
  const o = s.resolveHEAD();
  if (!o) {
    const v = s.getCurrentBranch();
    return v && s.updateBranchRef(v, r), s.checkoutTree(s.getCommitTree(r), e.volume), C(`Fast-forward
`);
  }
  if (o === r) return C(`Already up to date.
`);
  let l = r, a = !1;
  for (let v = 0; v < 1e3; v++) {
    if (l === o) {
      a = !0;
      break;
    }
    const $ = s.readCommit(l);
    if (!$ || !$.parent) break;
    l = $.parent;
  }
  if (a) {
    const v = s.getCurrentBranch();
    return v ? s.updateBranchRef(v, r) : s.setHEAD(r), s.checkoutTree(s.getCommitTree(r), e.volume), C(`Updating ${o.slice(0, 7)}..${r.slice(0, 7)}
Fast-forward
`);
  }
  const d = s.findMergeBase(o, r), c = d ? s.getCommitTree(d) : /* @__PURE__ */ new Map(), u = s.getCommitTree(o), h = s.getCommitTree(r), { conflicts: f } = st(s, e.volume, c, u, h);
  if (f.length > 0) {
    e.volume.writeFileSync(s.gitDir + "/MERGE_HEAD", r + `
`), e.volume.writeFileSync(s.gitDir + "/MERGE_MSG", `Merge branch '${i}'

Conflicts:
${f.map(($) => `	${$}`).join(`
`)}
`);
    let v = `Auto-merging failed; fix conflicts and then commit the result.
`;
    for (const $ of f) v += `CONFLICT (content): Merge conflict in ${$}
`;
    return {
      stdout: v,
      stderr: "",
      exitCode: 1
    };
  }
  const p = s.readIndex(), m = s.buildTree(p), g = `Merge branch '${i}'`, w = s.createCommit(g, o, m, r), x = s.getCurrentBranch();
  return x ? s.updateBranchRef(x, w) : s.setHEAD(w), C(`Merge made by the 'recursive' strategy.
`);
}
function Ai(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  if (t.includes("-d") || t.includes("--delete")) {
    const u = t.filter((h) => !h.startsWith("-"))[0];
    return u ? s.deleteTag(u) ? C(`Deleted tag '${u}'
`) : b(`error: tag '${u}' not found.
`) : b(`error: tag name required
`);
  }
  const i = t.includes("-a") || t.includes("-m");
  let r = "";
  const o = t.indexOf("-m");
  o >= 0 && (r = t[o + 1] ?? "");
  const l = t.filter((u, h) => !(u.startsWith("-") || o >= 0 && h === o + 1));
  if (l.length === 0) return C(s.listTags().sort().map((u) => u + `
`).join(""));
  const a = l[0], d = l[1] ?? "HEAD", c = s.resolveRef(d);
  if (!c) return b(`fatal: Failed to resolve '${d}' as a valid ref.
`, 128);
  if (i || r) {
    const u = s.writeAnnotatedTag(a, c, r || a);
    s.updateTagRef(a, u);
  } else s.updateTagRef(a, c);
  return C("");
}
function Cn(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.filter((c) => !c.startsWith("-"))[0] ?? "HEAD";
  let r = s.resolveRef(i);
  !r && /^[0-9a-f]{4,40}$/i.test(i) && (r = s.peelToCommit(i) ?? s.resolveRef(i));
  let o = r;
  try {
    o = e.volume.readFileSync(s.gitDir + "/refs/tags/" + i, "utf8").trim();
  } catch {
  }
  if (!r && !o) return b(`fatal: ambiguous argument '${i}'
`, 128);
  const l = r ?? o, a = s.readCommit(l);
  if (a) {
    let c = `${xe}commit ${l}${q}
`;
    c += `Author: ${a.author}
`, c += `Date:   ${new Date(a.timestamp).toUTCString()}

`, c += `    ${a.message}

`;
    const u = a.parent ? s.getCommitTree(a.parent) : /* @__PURE__ */ new Map(), h = s.getCommitTree(l), f = /* @__PURE__ */ new Set([...u.keys(), ...h.keys()]);
    for (const p of [...f].sort()) {
      const m = u.get(p), g = h.get(p);
      if (m === g) continue;
      const w = m ? s.getBlobContent(m) ?? "" : "", x = g ? s.getBlobContent(g) ?? "" : "";
      c += `${yn}diff --git a/${p} b/${p}${q}
`;
      const v = wt(w.split(`
`), x.split(`
`), e.limits?.maxLoopIterations);
      for (const $ of bn(v, 3)) {
        c += `${Je}@@ -${$.oldStart},${$.oldCount} +${$.newStart},${$.newCount} @@${q}
`;
        for (const y of $.lines) y.kind === "equal" ? c += ` ${y.line}
` : y.kind === "delete" ? c += `${Le}-${y.line}${q}
` : c += `${_e}+${y.line}${q}
`;
      }
    }
    return C(c);
  }
  const d = s.readObject(l);
  if (d?.type === "tag") {
    const c = JSON.parse(d.data);
    return C(`tag ${c.tag}
Tagger: ${c.tagger}

${c.message}

` + (Cn([c.object], e).stdout || ""));
  }
  return d?.type === "blob" ? C(d.data) : b(`fatal: bad object ${i}
`, 128);
}
function Ii(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("--staged"), r = t.indexOf("--source"), o = r >= 0 ? t[r + 1] : "HEAD", l = t.filter((c, u) => !(c.startsWith("-") || r >= 0 && u === r + 1));
  if (l.length === 0) return b(`error: pathspec required
`);
  const a = s.resolveRef(o), d = a ? s.getCommitTree(a) : /* @__PURE__ */ new Map();
  for (const c of l) {
    const u = we(e.cwd, c), h = Me(s.workDir, u);
    if (i) {
      const f = d.get(h);
      if (f) {
        const p = s.readIndex(), m = p.findIndex((w) => w.path === h), g = {
          path: h,
          hash: f,
          mode: 100644,
          mtime: Date.now()
        };
        m >= 0 ? p[m] = g : p.push(g), p.sort((w, x) => w.path.localeCompare(x.path)), s.writeIndex(p);
      } else s.removeFromIndex(h);
    } else {
      const f = d.get(h);
      if (f) {
        const p = s.getBlobContent(f);
        if (p !== null) {
          const m = u.substring(0, u.lastIndexOf("/"));
          m && !e.volume.existsSync(m) && e.volume.mkdirSync(m, { recursive: !0 }), e.volume.writeFileSync(u, p);
        }
      }
    }
  }
  return C("");
}
function Oi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("-f") || t.includes("--force"), r = t.includes("-n") || t.includes("--dry-run"), o = t.includes("-d");
  if (!i && !r) return b(`fatal: clean.requireForce defaults to true; use -f or -n
`, 128);
  const l = s.getUntrackedFiles();
  let a = "";
  for (const d of l)
    if (a += `Removing ${d}
`, !r) try {
      e.volume.unlinkSync(s.workDir + "/" + d);
    } catch {
    }
  if (o && !r) {
    let d = 0;
    const c = Math.min(e.limits?.maxFilesystemEntries ?? 1e5, 1e4), u = [s.workDir], h = [];
    for (; u.length > 0; ) {
      const f = u.pop();
      h.push(f);
      let p;
      try {
        p = e.volume.readdirSync(f);
      } catch {
        continue;
      }
      for (const m of p) {
        if (m === ".git") continue;
        if (++d > c) throw new Error(`filesystem entry limit ${c} exceeded`);
        const g = f + "/" + m;
        let w;
        try {
          w = e.volume.lstatSync(g);
        } catch {
          continue;
        }
        w.isDirectory() && u.push(g);
      }
    }
    for (let f = h.length - 1; f >= 0; f--) {
      const p = h[f];
      if (p !== s.workDir)
        try {
          e.volume.readdirSync(p).length === 0 && e.volume.rmdirSync(p);
        } catch {
        }
    }
  }
  return C(a);
}
function Bi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  if (t.includes("--abort")) {
    try {
      e.volume.unlinkSync(s.gitDir + "/CHERRY_PICK_HEAD");
      const m = s.resolveHEAD();
      m && s.checkoutTree(s.getCommitTree(m), e.volume);
    } catch {
      return b(`fatal: no cherry-pick in progress
`, 128);
    }
    return C("");
  }
  const i = t.filter((m) => !m.startsWith("-"))[0];
  if (!i) return b(`error: commit required
`);
  const r = s.resolveRef(i);
  if (!r) return b(`fatal: bad revision '${i}'
`, 128);
  const o = s.readCommit(r);
  if (!o) return b(`fatal: bad revision '${i}'
`, 128);
  const l = s.resolveHEAD();
  if (!l) return b(`fatal: not a valid HEAD
`, 128);
  const a = o.parent ? s.getCommitTree(o.parent) : /* @__PURE__ */ new Map(), d = s.getCommitTree(r), c = s.getCommitTree(l), { conflicts: u } = st(s, e.volume, a, c, d);
  if (u.length > 0) {
    e.volume.writeFileSync(s.gitDir + "/CHERRY_PICK_HEAD", r + `
`);
    let m = "";
    for (const g of u) m += `error: could not apply ${r.slice(0, 7)}... ${o.message.split(`
`)[0]}
CONFLICT in ${g}
`;
    return {
      stdout: m,
      stderr: "",
      exitCode: 1
    };
  }
  const h = s.buildTree(s.readIndex()), f = s.createCommit(o.message, l, h), p = s.getCurrentBranch();
  return p ? s.updateBranchRef(p, f) : s.setHEAD(f), C(`[${p ?? "detached"} ${f.slice(0, 7)}] ${o.message.split(`
`)[0]}
`);
}
function Pi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.filter((g) => !g.startsWith("-"))[0];
  if (!i) return b(`error: commit required
`);
  const r = s.resolveRef(i);
  if (!r) return b(`fatal: bad revision '${i}'
`, 128);
  const o = s.readCommit(r);
  if (!o) return b(`fatal: bad revision '${i}'
`, 128);
  const l = s.resolveHEAD();
  if (!l) return b(`fatal: not a valid HEAD
`, 128);
  const a = s.getCommitTree(r), d = o.parent ? s.getCommitTree(o.parent) : /* @__PURE__ */ new Map(), c = s.getCommitTree(l), { conflicts: u } = st(s, e.volume, a, c, d);
  if (u.length > 0) {
    let g = "";
    for (const w of u) g += `CONFLICT in ${w}
`;
    return {
      stdout: g,
      stderr: "",
      exitCode: 1
    };
  }
  const h = s.buildTree(s.readIndex()), f = `Revert "${o.message.split(`
`)[0]}"

This reverts commit ${r}.
`, p = s.createCommit(f, l, h), m = s.getCurrentBranch();
  return m ? s.updateBranchRef(m, p) : s.setHEAD(p), C(`[${m ?? "detached"} ${p.slice(0, 7)}] ${f.split(`
`)[0]}
`);
}
function Ti(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.filter((p) => !p.startsWith("-"))[0];
  if (!i) return b(`usage: git blame <file>
`);
  const r = we(e.cwd, i), o = Me(s.workDir, r);
  let l;
  try {
    l = e.volume.readFileSync(r, "utf8");
  } catch {
    return b(`fatal: no such path '${i}'
`, 128);
  }
  const a = l.split(`
`);
  a.length && a[a.length - 1] === "" && a.pop();
  const d = s.resolveHEAD(), c = d ? s.walkLog(d, 500) : [], u = a.map((p) => ({
    hash: "0000000",
    author: "unknown",
    line: p
  }));
  let h = /* @__PURE__ */ new Map();
  for (let p = c.length - 1; p >= 0; p--) {
    const m = c[p], g = s.getCommitTree(m.hash), w = h.has(o) ? s.getBlobContent(h.get(o)) ?? "" : "", x = g.has(o) ? s.getBlobContent(g.get(o)) ?? "" : "";
    if (w !== x) {
      const v = x.split(`
`);
      v.length && v[v.length - 1] === "" && v.pop();
      for (let $ = 0; $ < a.length; $++) v[$] === a[$] && (w.split(`
`)[$] !== a[$] || !h.has(o)) && (u[$] = {
        hash: m.hash.slice(0, 7),
        author: m.author.split(" <")[0],
        line: a[$]
      });
    }
    h = g;
  }
  let f = "";
  for (const p of u) f += `${p.hash} (${p.author}) ${p.line}
`;
  return C(f);
}
function Ri(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n;
  if (t.includes("--abort")) {
    try {
      e.volume.readFileSync(s.gitDir + "/REBASE_HEAD", "utf8").trim();
      const h = e.volume.readFileSync(s.gitDir + "/REBASE_ORIG_HEAD", "utf8").trim();
      s.checkoutTree(s.getCommitTree(h), e.volume);
      const f = s.getCurrentBranch();
      f ? s.updateBranchRef(f, h) : s.setHEAD(h);
      try {
        e.volume.unlinkSync(s.gitDir + "/REBASE_HEAD");
      } catch {
      }
      try {
        e.volume.unlinkSync(s.gitDir + "/REBASE_ORIG_HEAD");
      } catch {
      }
    } catch {
      return b(`fatal: no rebase in progress
`, 128);
    }
    return C(`Rebase aborted.
`);
  }
  const i = t.filter((h) => !h.startsWith("-"))[0];
  if (!i) return b(`usage: git rebase <upstream>
`);
  const r = s.resolveRef(i), o = s.resolveHEAD();
  if (!r || !o) return b(`fatal: invalid rebase refs
`, 128);
  if (r === o) return C(`Current branch is up to date.
`);
  const l = s.findMergeBase(o, r);
  if (!l) return b(`fatal: cannot find merge base
`, 128);
  const a = [];
  let d = o;
  for (; d && d !== l; ) {
    const h = s.readCommit(d);
    if (!h) break;
    a.push({
      hash: d,
      ...h
    }), d = h.parent;
  }
  a.reverse(), e.volume.writeFileSync(s.gitDir + "/REBASE_ORIG_HEAD", o + `
`), e.volume.writeFileSync(s.gitDir + "/REBASE_HEAD", r + `
`);
  const c = s.getCurrentBranch();
  c ? s.updateBranchRef(c, r) : s.setHEAD(r), s.checkoutTree(s.getCommitTree(r), e.volume);
  let u = r;
  for (const h of a) {
    const f = h.parent ? s.getCommitTree(h.parent) : /* @__PURE__ */ new Map(), p = s.getCommitTree(h.hash), m = s.getCommitTree(u), { conflicts: g } = st(s, e.volume, f, m, p);
    if (g.length > 0) {
      let x = `error: could not apply ${h.hash.slice(0, 7)}... ${h.message.split(`
`)[0]}
`;
      for (const v of g) x += `CONFLICT in ${v}
`;
      return x += "Resolve conflicts and run `git rebase --abort` or commit to continue.\n", {
        stdout: x,
        stderr: "",
        exitCode: 1
      };
    }
    const w = s.buildTree(s.readIndex());
    u = s.createCommit(h.message, u, w), c ? s.updateBranchRef(c, u) : s.setHEAD(u);
  }
  try {
    e.volume.unlinkSync(s.gitDir + "/REBASE_HEAD");
  } catch {
  }
  try {
    e.volume.unlinkSync(s.gitDir + "/REBASE_ORIG_HEAD");
  } catch {
  }
  return C(`Successfully rebased ${a.length} commit(s).
`);
}
function Yt(t) {
  if (t === void 0) return 0;
  const e = t.match(/^stash@\{(\d+)\}$/);
  return e ? parseInt(e[1], 10) : /^\d+$/.test(t) ? parseInt(t, 10) : null;
}
function Ni(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t[0] ?? "push";
  if (i === "list") {
    const r = s.readStashList();
    let o = "";
    for (let l = 0; l < r.length; l++) o += `stash@{${l}}: ${r[l].message}
`;
    return C(o);
  }
  if (i === "push" || i === "save" || !t[0]) {
    const r = t.find((m) => !m.startsWith("-")) && t[0] !== "push" && t[0] !== "save" ? t.join(" ") : "WIP on " + (s.getCurrentBranch() ?? "HEAD"), o = s.diffWorkingVsIndex(), l = s.diffIndexVsHEAD();
    if (o.length === 0 && l.length === 0) return C(`No local changes to save
`);
    const a = s.readIndex();
    s.walkWorkTree(s.workDir, "", (m, g) => {
      s.addToIndex(m, g);
    });
    const d = s.readIndex(), c = s.buildTree(d), u = s.resolveHEAD(), h = s.createCommit("stash: " + r, u, c);
    s.writeIndex(a);
    const f = s.resolveHEAD();
    if (f) {
      const m = s.getCommitTree(f);
      for (const [g, w] of m) {
        const x = s.getBlobContent(w);
        if (x !== null) {
          const v = s.workDir + "/" + g, $ = v.substring(0, v.lastIndexOf("/"));
          $ && !e.volume.existsSync($) && e.volume.mkdirSync($, { recursive: !0 }), e.volume.writeFileSync(v, x);
        }
      }
    }
    const p = s.readStashList();
    return p.unshift({
      message: r,
      commitHash: h
    }), s.writeStashList(p), C(`Saved working directory and index state ${r}
`);
  }
  if (i === "pop" || i === "apply") {
    const r = Yt(t[1]);
    if (r === null) return b(`error: '${t[1]}' is not a valid reference
`);
    const o = s.readStashList();
    if (r >= o.length) return b(`error: stash@{${r}} does not exist
`);
    const l = o[r], a = s.getCommitTree(l.commitHash);
    for (const [d, c] of a) {
      const u = s.getBlobContent(c);
      if (u !== null) {
        const h = s.workDir + "/" + d, f = h.substring(0, h.lastIndexOf("/"));
        f && !e.volume.existsSync(f) && e.volume.mkdirSync(f, { recursive: !0 }), e.volume.writeFileSync(h, u);
      }
    }
    return i === "pop" && (o.splice(r, 1), s.writeStashList(o)), C(`Applied stash@{${r}}
`);
  }
  if (i === "drop") {
    const r = Yt(t[1]);
    if (r === null) return b(`error: '${t[1]}' is not a valid reference
`);
    const o = s.readStashList();
    return r >= o.length ? b(`error: stash@{${r}} does not exist
`) : (o.splice(r, 1), s.writeStashList(o), C(`Dropped stash@{${r}}
`));
  }
  return b(`error: unknown stash subcommand '${i}'
`);
}
function Hi(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("--cached"), r = t.filter((o) => !o.startsWith("-"));
  if (r.length === 0) return b(`usage: git rm [--cached] <file>...
`);
  for (const o of r) {
    const l = we(e.cwd, o), a = Me(s.workDir, l);
    if (s.removeFromIndex(a), !i) try {
      e.volume.unlinkSync(l);
    } catch {
    }
  }
  return C("");
}
function _i(t, e) {
  const n = j(e.volume, e.cwd);
  if ("error" in n) return n.error;
  const { repo: s } = n, i = t.includes("--hard"), r = t.includes("--soft"), o = t.filter((c) => !c.startsWith("-"));
  if (o.length > 0 && !i && !r) {
    const c = s.resolveHEAD(), u = c ? s.getCommitTree(c) : /* @__PURE__ */ new Map();
    for (const h of o) {
      const f = we(e.cwd, h), p = Me(s.workDir, f), m = u.get(p);
      if (m) {
        const g = s.readIndex(), w = g.findIndex((x) => x.path === p);
        w >= 0 && (g[w].hash = m, s.writeIndex(g));
      } else s.removeFromIndex(p);
    }
    return C("");
  }
  const l = o[0] ?? "HEAD", a = s.resolveRef(l) ?? s.resolveHEAD();
  if (!a) return b(`fatal: Failed to resolve HEAD
`, 128);
  if (!r) {
    const c = s.getCommitTree(a), u = [];
    for (const [h, f] of c) u.push({
      path: h,
      hash: f,
      mode: 100644,
      mtime: Date.now()
    });
    u.sort((h, f) => h.path.localeCompare(f.path)), s.writeIndex(u);
  }
  if (i) {
    const c = s.getCommitTree(a);
    for (const [u, h] of c) {
      const f = s.getBlobContent(h);
      if (f !== null) {
        const p = s.workDir + "/" + u, m = p.substring(0, p.lastIndexOf("/"));
        m && !e.volume.existsSync(m) && e.volume.mkdirSync(m, { recursive: !0 }), e.volume.writeFileSync(p, f);
      }
    }
  }
  const d = s.getCurrentBranch();
  return d && s.updateBranchRef(d, a), C(`HEAD is now at ${a.slice(0, 7)}
`);
}
function it(t) {
  return t.GITHUB_TOKEN || t.GH_TOKEN || null;
}
async function Li(t, e) {
  const n = nt(e), s = t.filter((F) => !F.startsWith("-")), i = s[0];
  if (!i) return b(`usage: git clone <repository> [<directory>]
`);
  let r = "main";
  const o = t.indexOf("-b");
  o >= 0 && t[o + 1] && (r = t[o + 1]);
  const l = new ue(e.volume, "/", "/").parseGitHubUrl(i);
  if (!l) return b(`fatal: repository '${i}' is not a GitHub URL
`, 128);
  const a = it(e.env);
  if (!a) return b(`fatal: authentication required. Set GITHUB_TOKEN environment variable.
`, 128);
  let d = s[1] ?? l.repo;
  d.startsWith("/") || (d = we(e.cwd, d));
  const c = await n(`/repos/${l.owner}/${l.repo}`, a);
  if (!c.ok)
    return c.status === 404 ? b(`fatal: repository '${i}' not found
`, 128) : b(`fatal: GitHub API error: ${c.status} ${c.data?.message ?? ""}
`, 128);
  const u = c.data.default_branch ?? "main";
  r === "main" && u !== "main" && (r = u);
  const h = await n(`/repos/${l.owner}/${l.repo}/git/ref/heads/${r}`, a);
  if (!h.ok) return b(`fatal: Remote branch '${r}' not found
`, 128);
  const f = h.data.object.sha, p = await n(`/repos/${l.owner}/${l.repo}/git/commits/${f}`, a);
  if (!p.ok) return b(`fatal: could not fetch commit
`, 128);
  const m = p.data.tree.sha, g = await n(`/repos/${l.owner}/${l.repo}/git/trees/${m}?recursive=1`, a);
  if (!g.ok) return b(`fatal: could not fetch tree
`, 128);
  const w = Array.isArray(g.data?.tree) ? g.data.tree : [], x = e.limits?.maxFilesystemEntries ?? 1e5;
  if (w.length > x) return b(`fatal: repository exceeds ${x} entries
`, 128);
  e.volume.existsSync(d) || e.volume.mkdirSync(d, { recursive: !0 });
  let v = 0;
  const $ = [];
  for (const F of w) if (F.type === "blob") {
    if (!St(F.path)) return b(`fatal: remote contains an unsafe path
`, 128);
    $.push({
      path: F.path,
      sha: F.sha
    });
  }
  const y = 10, A = (e.limits?.maxOutputBytes ?? 4194304) * 32;
  let M = 0;
  for (let F = 0; F < $.length; F += y) {
    if (e.signal?.aborted) return b(`fatal: clone cancelled
`, 130);
    F > 0 && await re(e.signal);
    const ne = $.slice(F, F + y), Pe = await Promise.all(ne.map((T) => n(`/repos/${l.owner}/${l.repo}/git/blobs/${T.sha}`, a)));
    for (let T = 0; T < ne.length; T++) {
      const W = Pe[T];
      if (!W.ok) continue;
      const ae = d + "/" + ne[T].path, V = ae.substring(0, ae.lastIndexOf("/"));
      V && !e.volume.existsSync(V) && e.volume.mkdirSync(V, { recursive: !0 });
      let z;
      if (W.data.encoding === "base64" ? z = atob(W.data.content.replace(/\n/g, "")) : z = W.data.content, M += z.length, M > A) return b(`fatal: repository data exceeds ${A} bytes
`, 128);
      e.volume.writeFileSync(ae, z), v++;
    }
  }
  $n([], {
    ...e,
    cwd: d
  });
  const B = new ue(e.volume, d, d + "/.git");
  B.setConfigValue("remote.origin.url", i), B.setConfigValue("remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"), B.setConfigValue("branch." + r + ".remote", "origin"), B.setConfigValue("branch." + r + ".merge", "refs/heads/" + r), B.setHEAD("ref: refs/heads/" + r), B.walkWorkTree(d, "", (F, ne) => {
    B.addToIndex(F, ne);
  });
  const K = B.readIndex(), Be = B.buildTree(K), X = p.data.commit?.author?.name && p.data.commit?.author?.email ? `${p.data.commit.author.name} <${p.data.commit.author.email}>` : `${B.getConfigValue("user.name") ?? "nodepod-user"} <${B.getConfigValue("user.email") ?? "user@nodepod.dev"}>`, Q = {
    tree: Be,
    parent: p.data.parents?.[0]?.sha ?? null,
    author: X,
    committer: X,
    timestamp: p.data.commit?.author?.date ? Date.parse(p.data.commit.author.date) : Date.now(),
    message: p.data.message ?? `Clone of ${i}`
  };
  return p.data.parents?.[1]?.sha && (Q.parent2 = p.data.parents[1].sha), B.writeObjectAt(f, "commit", JSON.stringify(Q)), B.updateBranchRef(r, f), B.updateRemoteRef("origin", r, f), C(`Cloning into '${s[1] ?? l.repo}'...
remote: Enumerating objects: ${v}
Receiving objects: 100% (${v}/${v}), done.
`);
}
async function ji(t, e) {
  const n = nt(e), s = j(e.volume, e.cwd);
  if ("error" in s) return s.error;
  const { repo: i } = s, r = it(e.env);
  if (!r) return b(`fatal: authentication required. Set GITHUB_TOKEN environment variable.
`, 128);
  const o = t.filter((A) => !A.startsWith("-")), l = o[0] ?? "origin", a = i.getCurrentBranch();
  if (!a) return b(`fatal: not on a branch
`, 128);
  const d = o[1] ?? a, c = i.getRemoteUrl(l);
  if (!c) return b(`fatal: '${l}' does not appear to be a git repository
`, 128);
  const u = i.parseGitHubUrl(c);
  if (!u) return b(`fatal: remote '${l}' is not a GitHub URL
`, 128);
  const h = i.resolveHEAD();
  if (!h) return b(`fatal: nothing to push
`, 128);
  const f = i.getCommitTree(h), p = /* @__PURE__ */ new Map();
  let m = 0;
  for (const [A, M] of f) {
    if (e.signal?.aborted) return b(`fatal: push cancelled
`, 130);
    m > 0 && (m & 31) === 0 && await re(e.signal);
    const B = i.getBlobContent(M);
    if (B === null) continue;
    if (B.length > (e.limits?.maxOutputBytes ?? 4194304)) return b(`fatal: blob '${A}' exceeds request size limit
`, 128);
    const K = await n(`/repos/${u.owner}/${u.repo}/git/blobs`, r, "POST", {
      content: btoa(B),
      encoding: "base64"
    });
    if (!K.ok) return b(`fatal: failed to create blob for ${A}: ${K.data?.message}
`, 128);
    p.set(A, K.data.sha), m++;
  }
  const g = Array.from(p).map(([A, M]) => ({
    path: A,
    mode: "100644",
    type: "blob",
    sha: M
  })), w = await n(`/repos/${u.owner}/${u.repo}/git/trees`, r, "POST", { tree: g });
  if (!w.ok) return b(`fatal: failed to create tree: ${w.data?.message}
`, 128);
  let x = null;
  const v = await n(`/repos/${u.owner}/${u.repo}/git/ref/heads/${d}`, r);
  v.ok && (x = v.data.object.sha);
  const $ = {
    message: i.readCommit(h)?.message ?? "Push from nodepod",
    tree: w.data.sha
  };
  x && ($.parents = [x]);
  const y = await n(`/repos/${u.owner}/${u.repo}/git/commits`, r, "POST", $);
  if (!y.ok) return b(`fatal: failed to create commit: ${y.data?.message}
`, 128);
  if (x) {
    const A = t.includes("-f") || t.includes("--force"), M = await n(`/repos/${u.owner}/${u.repo}/git/refs/heads/${d}`, r, "PATCH", {
      sha: y.data.sha,
      force: A
    });
    if (!M.ok) return b(`fatal: failed to update ref: ${M.data?.message}
`, 128);
  } else {
    const A = await n(`/repos/${u.owner}/${u.repo}/git/refs`, r, "POST", {
      ref: `refs/heads/${d}`,
      sha: y.data.sha
    });
    if (!A.ok) return b(`fatal: failed to create ref: ${A.data?.message}
`, 128);
  }
  return C(`To ${c}
   ${(x ?? "000000").slice(0, 7)}..${y.data.sha.slice(0, 7)}  ${a} -> ${d}
`);
}
async function Mi(t, e) {
  const n = nt(e), s = j(e.volume, e.cwd);
  if ("error" in s) return s.error;
  const { repo: i } = s, r = it(e.env);
  if (!r) return b(`fatal: authentication required. Set GITHUB_TOKEN environment variable.
`, 128);
  const o = t.filter((T) => !T.startsWith("-")), l = o[0] ?? "origin", a = i.getCurrentBranch();
  if (!a) return b(`fatal: not on a branch
`, 128);
  const d = o[1] ?? a, c = i.getRemoteUrl(l);
  if (!c) return b(`fatal: '${l}' does not appear to be a git repository
`, 128);
  const u = i.parseGitHubUrl(c);
  if (!u) return b(`fatal: remote '${l}' is not a GitHub URL
`, 128);
  const h = await n(`/repos/${u.owner}/${u.repo}/git/ref/heads/${d}`, r);
  if (!h.ok) return b(`fatal: couldn't find remote ref refs/heads/${d}
`, 128);
  const f = h.data.object.sha, p = i.resolveHEAD();
  if (p === f) return C(`Already up to date.
`);
  const m = await n(`/repos/${u.owner}/${u.repo}/git/commits/${f}`, r);
  if (!m.ok) return b(`fatal: could not fetch remote commit
`, 128);
  const g = m.data.tree.sha, w = await n(`/repos/${u.owner}/${u.repo}/git/trees/${g}?recursive=1`, r);
  if (!w.ok) return b(`fatal: could not fetch tree
`, 128);
  const x = Array.isArray(w.data?.tree) ? w.data.tree : [], v = e.limits?.maxFilesystemEntries ?? 1e5;
  if (x.length > v) return b(`fatal: repository exceeds ${v} entries
`, 128);
  let $ = 0;
  const y = [];
  for (const T of x) if (T.type === "blob") {
    if (!St(T.path)) return b(`fatal: remote contains an unsafe path
`, 128);
    y.push({
      path: T.path,
      sha: T.sha
    });
  }
  const A = 10, M = (e.limits?.maxOutputBytes ?? 4194304) * 32;
  let B = 0;
  for (let T = 0; T < y.length; T += A) {
    if (e.signal?.aborted) return b(`fatal: pull cancelled
`, 130);
    T > 0 && await re(e.signal);
    const W = y.slice(T, T + A), ae = await Promise.all(W.map((V) => n(`/repos/${u.owner}/${u.repo}/git/blobs/${V.sha}`, r)));
    for (let V = 0; V < W.length; V++) {
      const z = ae[V];
      if (!z.ok) continue;
      const De = i.workDir + "/" + W[V].path, ve = De.substring(0, De.lastIndexOf("/"));
      ve && !e.volume.existsSync(ve) && e.volume.mkdirSync(ve, { recursive: !0 });
      let ye;
      if (z.data.encoding === "base64" ? ye = atob(z.data.content.replace(/\n/g, "")) : ye = z.data.content, B += ye.length, B > M) return b(`fatal: repository data exceeds ${M} bytes
`, 128);
      e.volume.writeFileSync(De, ye), $++;
    }
  }
  i.walkWorkTree(i.workDir, "", (T, W) => {
    i.addToIndex(T, W);
  });
  const K = i.readIndex(), Be = i.buildTree(K), X = m.data.commit?.author?.name && m.data.commit?.author?.email ? `${m.data.commit.author.name} <${m.data.commit.author.email}>` : `${i.getConfigValue("user.name") ?? "nodepod-user"} <${i.getConfigValue("user.email") ?? "user@nodepod.dev"}>`, Q = m.data.parents?.[0]?.sha ?? null, F = {
    tree: Be,
    parent: Q,
    author: X,
    committer: X,
    timestamp: m.data.commit?.author?.date ? Date.parse(m.data.commit.author.date) : Date.now(),
    message: m.data.message ?? `Pull from ${l}/${d}`
  };
  m.data.parents?.[1]?.sha && (F.parent2 = m.data.parents[1].sha);
  const ne = !p || p === Q || i.isAncestor(p, Q);
  i.writeObjectAt(f, "commit", JSON.stringify(F)), i.updateBranchRef(a, f), i.updateRemoteRef(l, d, f);
  const Pe = ne ? `Fast-forward
` : `Updating work tree to ${f.slice(0, 7)}
`;
  return C(`From ${c}
Updating ${(p ?? "0000000").slice(0, 7)}..${f.slice(0, 7)}
${Pe} ${$} file${$ !== 1 ? "s" : ""} changed
`);
}
async function Fi(t, e) {
  const n = nt(e), s = j(e.volume, e.cwd);
  if ("error" in s) return s.error;
  const { repo: i } = s, r = it(e.env);
  if (!r) return b(`fatal: authentication required. Set GITHUB_TOKEN environment variable.
`, 128);
  const o = t.filter((p) => !p.startsWith("-"))[0] ?? "origin", l = i.getRemoteUrl(o);
  if (!l) return b(`fatal: '${o}' does not appear to be a git repository
`, 128);
  const a = i.parseGitHubUrl(l);
  if (!a) return b(`fatal: remote '${o}' is not a GitHub URL
`, 128);
  const d = await n(`/repos/${a.owner}/${a.repo}/branches`, r);
  if (!d.ok) return b(`fatal: could not list remote branches
`, 128);
  const c = Array.isArray(d.data) ? d.data : [], u = e.limits?.maxFilesystemEntries ?? 1e5;
  if (c.length > u) return b(`fatal: remote exceeds ${u} branches
`, 128);
  let h = `From ${l}
`;
  const f = e.limits?.maxOutputBytes ?? 4194304;
  for (let p = 0; p < c.length; p++) {
    if (e.signal?.aborted) return b(`fatal: fetch cancelled
`, 130);
    p > 0 && (p & 127) === 0 && await re(e.signal);
    const m = c[p];
    if (!St(m.name)) return b(`fatal: remote contains an unsafe branch name
`, 128);
    const g = i.gitDir + "/refs/remotes/" + o + "/" + m.name, w = g.substring(0, g.lastIndexOf("/"));
    if (e.volume.existsSync(w) || e.volume.mkdirSync(w, { recursive: !0 }), e.volume.writeFileSync(g, m.commit.sha + `
`), h += ` * [updated]    ${m.name} -> ${o}/${m.name}
`, h.length > f) return b(`fatal: output exceeds ${f} bytes
`, 128);
  }
  return C(h);
}
function Wi() {
  return {
    name: "git",
    async execute(t, e) {
      if (t.length === 0) return C(`usage: git [--version] <command> [<args>]
`);
      let n = e;
      if (t[0] === "-C" && t[1]) {
        const r = we(e.cwd, t[1]);
        n = {
          ...e,
          cwd: r
        }, t = t.slice(2);
      }
      const s = t[0], i = t.slice(1);
      switch (s) {
        case "--version":
        case "-v":
          return C(`git version ${J.GIT}
`);
        case "--help":
        case "help":
          return C(`usage: git <command> [<args>]

Available commands:
  init       Create an empty Git repository
  clone      Clone a repository from GitHub
  add        Add file contents to the index
  status     Show the working tree status
  commit     Record changes to the repository
  log        Show commit logs
  show       Show various types of objects
  diff       Show changes
  branch     List, create, or delete branches
  checkout   Switch branches or restore files
  switch     Switch branches
  restore    Restore working tree files
  clean      Remove untracked files
  merge      Join two development histories together
  cherry-pick Apply the changes introduced by some existing commits
  revert     Revert some existing commits
  rebase     Reapply commits on top of another base tip
  tag        Create, list, or delete tags
  blame      Show what revision and author last modified each line
  remote     Manage set of tracked repositories
  push       Update remote refs (GitHub)
  pull       Fetch and integrate remote changes (GitHub)
  fetch      Download objects from remote (GitHub)
  stash      Stash the changes in a dirty working directory
  reset      Reset current HEAD to the specified state
  rm         Remove files from the working tree and index
  rev-parse  Ancillary plumbing command
  config     Get and set repository options
`);
        case "init":
          return $n(i, n);
        case "clone":
          return Li(i, n);
        case "add":
          return gi(i, n);
        case "status":
          return wi(i, n);
        case "commit":
          return vi(i, n);
        case "log":
          return yi(i, n);
        case "diff":
          return bi(i, n);
        case "branch":
          return $i(i, n);
        case "checkout":
          return xn(i, n);
        case "switch":
          return xi(i, n);
        case "merge":
          return Di(i, n);
        case "tag":
          return Ai(i, n);
        case "show":
          return Cn(i, n);
        case "restore":
          return Ii(i, n);
        case "clean":
          return Oi(i, n);
        case "cherry-pick":
          return Bi(i, n);
        case "revert":
          return Pi(i, n);
        case "blame":
          return Ti(i, n);
        case "rebase":
          return Ri(i, n);
        case "remote":
          return Si(i, n);
        case "push":
          return ji(i, n);
        case "pull":
          return Mi(i, n);
        case "fetch":
          return Fi(i, n);
        case "stash":
          return Ni(i, n);
        case "reset":
          return _i(i, n);
        case "rm":
          return Hi(i, n);
        case "rev-parse":
          return Ci(i, n);
        case "config":
          return ki(i, n);
        default:
          return b(`git: '${s}' is not a git command. See 'git --help'.
`);
      }
    }
  };
}
var P = null, k = null, qe = globalThis.setTimeout.bind(globalThis), Ce = null, kn = !0, Ee = null, rt = null, ot = null, at = !0, lt = null, ct = null, Ye = null, vt = /* @__PURE__ */ new Set();
function qi(t, e) {
  for (const n of vt)
    n.stdout?._setSize?.(t, e), n.stderr?._setSize?.(t, e);
}
function ke() {
  return te()?.stdoutSink ?? Ee;
}
function Se() {
  return te()?.stderrSink ?? rt;
}
function zi() {
  const t = te();
  return t ? t.abortController.signal : ot;
}
function Dt() {
  return te()?.liveStdin ?? Re;
}
function Gi() {
  return te()?.termCols?.() ?? lt?.() ?? 80;
}
function Ui() {
  return te()?.termRows?.() ?? ct?.() ?? 24;
}
function Kt(t) {
  if (t instanceof Error) {
    let e = (t.constructor?.name && t.constructor.name !== "Error" ? `${t.constructor.name}: ` : "") + (t.message || t.name || "Unknown error");
    return t.stack && (e += `
` + t.stack), e;
  }
  return t == null ? "Script threw a falsy value" : String(t) || "Unknown error (non-Error object thrown)";
}
function Vi(t) {
  at = t.isTTY ?? !0, Ee = t.onStdout ?? null, rt = t.onStderr ?? null, ot = t.signal ?? null, lt = t.getCols ?? null, ct = t.getRows ?? null, Ye = t.onRawModeChange ?? null, P?.setCancellationSignal(t.signal ?? null), P?.setBackgroundOutputCallbacks(t.onStdout ?? null, t.onStderr ?? null);
  const e = te();
  e && (e.stdoutSink = t.onStdout ?? null, e.stderrSink = t.onStderr ?? null, t.signal && t.signal.addEventListener("abort", () => e.abortController.abort(), { once: !0 }), e.termCols = t.getCols ?? null, e.termRows = t.getRows ?? null);
}
function Ji() {
  at = !0, Ee = null, rt = null, ot = null, lt = null, ct = null, Ye = null, P?.setCancellationSignal(null), P?.setBackgroundOutputCallbacks(null, null);
  const t = te();
  t && (t.stdoutSink = null, t.stderrSink = null, t.termCols = null, t.termRows = null);
}
function Zi(t) {
  Ce = t;
}
function Yi(t) {
  kn = t;
}
var je = null;
function Ki(t) {
  je = t;
}
var yt = null;
function Qi(t) {
  yt = t;
}
var Ge = null, bt = null, Sn = null, Ke = null, $t = !1, Ue = [];
function Xi(t, e = "json", n) {
  Ge = (s) => t(vn(s, e)), Sn = n ?? null;
}
function Pr() {
  Ke ? Ke() : $t = !0;
}
function En(t) {
  if (bt = t, Ue.length > 0) {
    const e = Ue;
    Ue = [];
    for (const n of e) t(n);
  }
}
function er(t) {
  bt ? bt(t) : Ue.push(t);
}
function Qe() {
  return P?.getCwd() ?? "/";
}
function Tr(t) {
  P && P.setCwd(t);
}
function tr(t, e, n) {
  if (!P) {
    n(/* @__PURE__ */ new Error("[Nodepod] Shell not initialized"), "", "");
    return;
  }
  P.exec(t, e).then((s) => {
    if (s.exitCode !== 0) {
      const i = /* @__PURE__ */ new Error(`Command failed: ${t}`);
      i.code = s.exitCode, n(i, s.stdout, s.stderr);
    } else n(null, s.stdout, s.stderr);
  }, (s) => {
    n(s instanceof Error ? s : new Error(String(s)), "", "");
  });
}
var Re = null;
function Rr() {
  const t = Dt();
  return t ? !!t.isRaw : !1;
}
function nr(t) {
  const e = Dt();
  e && e.emit("data", t);
}
function Nr() {
  Dt()?.emit("end");
}
function sr(t, e) {
  k = t, P = new ti(t, {
    cwd: e?.cwd ?? "/",
    env: {
      HOME: "/home/user",
      USER: "user",
      PATH: "/usr/local/bin:/usr/bin:/bin:/node_modules/.bin",
      NODE_ENV: "development",
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      npm_config_user_agent: dt.npm_config_user_agent,
      npm_execpath: dt.npm_execpath,
      npm_node_execpath: dt.npm_node_execpath,
      ...e?.env
    },
    shell: e?.shell
  });
  const n = {
    installPackages: Bt,
    uninstallPackages: Nn,
    listPackages: pr,
    runScript: or,
    npmInitOrCreate: mr,
    npmInfo: gr,
    npmPack: (s) => is(k, s),
    npmConfig: (s, i) => ls(k, s, i),
    npmPkg: (s, i) => cs(k, s, i),
    npmCi: wr,
    npmOutdated: (s) => ss(k, s),
    npmAudit: (s) => ns(k, s),
    npmFund: (s) => ms(k, s),
    npmPing: (s) => ds(k, s),
    npmWhoami: (s) => os(k, s),
    npmCacheClean: () => as(),
    npxExecute: Hn,
    executeNodeBinary: ft,
    evalCode: (s, i) => An(s, i, ft),
    printCode: (s, i) => rr(s, i, ft),
    removeNodeModules: (s) => {
      const i = `${s}/node_modules`.replace(/\/+/g, "/");
      k.existsSync(i) && At(k, i);
    },
    formatErr: Z,
    formatWarn: Ot,
    hasFile: (s) => !!k && k.existsSync(s),
    readFile: (s) => k.readFileSync(s, "utf8"),
    writeFile: (s, i) => k.writeFileSync(s, i)
  };
  P.registerCommand(hi(n)), P.registerCommand(fi(n)), P.registerCommand(ni(n)), P.registerCommand(ri(n)), P.registerCommand(ai(n)), P.registerCommand(ui(n)), P.registerCommand(di(n)), P.registerCommand(Wi());
}
async function ft(t, e, n) {
  if (!je) return Fe(t, e, n);
  const s = ke(), i = Se(), r = je("node", [t, ...e], {
    cwd: n.cwd,
    env: n.env,
    stdio: "inherit",
    onStdout: s ?? void 0,
    onStderr: i ?? void 0
  }), o = () => r.kill?.("SIGKILL");
  n.signal?.aborted ? o() : n.signal?.addEventListener("abort", o, { once: !0 });
  try {
    const l = await r;
    return {
      stdout: l.stdout,
      stderr: l.stderr,
      exitCode: n.signal?.aborted ? 130 : l.exitCode
    };
  } catch (l) {
    return {
      stdout: "",
      stderr: `node: ${l instanceof Error ? l.message : String(l)}
`,
      exitCode: n.signal?.aborted ? 130 : 1
    };
  } finally {
    n.signal?.removeEventListener("abort", o);
  }
}
var Dn = "/<eval-";
function ir(t) {
  return t.startsWith(Dn) && t.lastIndexOf("/") === 0;
}
function An(t, e, n = Fe) {
  if (!k) return Promise.resolve({
    stdout: "",
    stderr: `Volume unavailable
`,
    exitCode: 1
  });
  const s = `${Dn}${Date.now()}-${Math.random().toString(36).slice(2)}>.js`;
  return k.writeFileSync(s, t), n(s, [], e).finally(() => {
    try {
      k.existsSync(s) && k.unlinkSync(s);
    } catch {
    }
  });
}
function rr(t, e, n = Fe) {
  return An(`const __nodepodPrintResult = (${t});
if (typeof __nodepodPrintResult !== 'undefined') { process.stdout.write(String(__nodepodPrintResult) + '\\n'); }
`, e, n);
}
function At(t, e, n = { entries: 0 }) {
  const s = [{
    path: e,
    visited: !1
  }];
  for (; s.length > 0; ) {
    const i = s.pop();
    if (i.visited) {
      t.rmdirSync(i.path);
      continue;
    }
    if (++n.entries > 1e5) throw new Error("filesystem entry limit 100000 exceeded");
    s.push({
      path: i.path,
      visited: !0
    });
    for (const r of t.readdirSync(i.path)) {
      const o = `${i.path}/${r}`;
      if (t.lstatSync(o).isDirectory()) s.push({
        path: o,
        visited: !1
      });
      else {
        if (++n.entries > 1e5) throw new Error("filesystem entry limit 100000 exceeded");
        t.unlinkSync(o);
      }
    }
  }
}
function Xe(t) {
  const e = `${t}/package.json`.replace(/\/+/g, "/");
  if (!k.existsSync(e)) return { fail: {
    stdout: "",
    stderr: Z("package.json not found", "npm"),
    exitCode: 1
  } };
  try {
    return { pkg: JSON.parse(k.readFileSync(e, "utf8")) };
  } catch {
    return { fail: {
      stdout: "",
      stderr: Z("Malformed package.json", "npm"),
      exitCode: 1
    } };
  }
}
function Qt(t) {
  return t === "-s" || t === "--silent";
}
async function or(t, e) {
  const n = t.indexOf("--"), s = n >= 0 ? t.slice(0, n) : t, i = n >= 0 ? t.slice(n + 1) : [], r = s.some(Qt), o = s.find((y) => !Qt(y));
  if (!o) {
    const y = Xe(e.cwd);
    if ("fail" in y) return y.fail;
    const A = y.pkg.scripts ?? {}, M = Object.keys(A);
    if (M.length === 0) return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
    let B = `Scripts in ${y.pkg.name ?? ""}:
`;
    for (const K of M) B += `  ${K}
    ${A[K]}
`;
    return {
      stdout: B,
      stderr: "",
      exitCode: 0
    };
  }
  const l = Xe(e.cwd);
  if ("fail" in l) return l.fail;
  const a = l.pkg.scripts ?? {};
  let d = a[o];
  if (!d) {
    let y = Z(`Missing script: "${o}"`, "npm");
    const A = Object.keys(a);
    if (A.length) {
      y += `
Available:
`;
      for (const M of A) y += `  ${ie}${M}${E}: ${H}${a[M]}${E}
`;
    }
    return {
      stdout: "",
      stderr: y,
      exitCode: 1
    };
  }
  i.length > 0 && (d += " " + i.map(Ve).join(" "));
  const c = `${e.cwd}/node_modules/.bin`.replace(/\/+/g, "/"), u = e.env.PATH || "", h = u.includes(c) ? u : `${c}:${u}`, f = {
    ...e.env,
    PATH: h,
    npm_lifecycle_event: o
  };
  l.pkg.name && (f.npm_package_name = l.pkg.name), l.pkg.version && (f.npm_package_version = l.pkg.version);
  let p = "", m = "";
  const g = `${l.pkg.name ?? ""}@${l.pkg.version ?? ""}`, w = (y) => {
    r || (p += y, ke()?.(y));
  }, x = a[`pre${o}`];
  if (x) {
    w(`
> ${g} pre${o}
> ${x}

`);
    const y = await e.exec(x, {
      cwd: e.cwd,
      env: f
    });
    if (p += y.stdout, m += y.stderr, y.exitCode !== 0) return {
      stdout: p,
      stderr: m,
      exitCode: y.exitCode
    };
  }
  w(`
> ${g} ${o}
> ${d}

`);
  const v = await e.exec(d, {
    cwd: e.cwd,
    env: f
  });
  if (p += v.stdout, m += v.stderr, v.exitCode !== 0) return {
    stdout: p,
    stderr: m,
    exitCode: v.exitCode
  };
  const $ = a[`post${o}`];
  if ($) {
    w(`
> ${g} post${o}
> ${$}

`);
    const y = await e.exec($, {
      cwd: e.cwd,
      env: f
    });
    if (p += y.stdout, m += y.stderr, y.exitCode !== 0) return {
      stdout: p,
      stderr: m,
      exitCode: y.exitCode
    };
  }
  return {
    stdout: p,
    stderr: m,
    exitCode: 0
  };
}
var E = "\x1B[0m", ge = "\x1B[1m", H = "\x1B[2m", de = "\x1B[31m", It = "\x1B[32m", Ie = "\x1B[33m", ar = "\x1B[34m", ie = "\x1B[36m", lr = "\x1B[37m", pt = "\x1B[2K", Xt = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏"
];
function In(t, e) {
  if (!at) return {
    update(r) {
    },
    succeed(r) {
      e(Mt(r) + `
`);
    },
    fail(r) {
      e(Mt(r) + `
`);
    },
    stop() {
    }
  };
  let n = 0, s = t;
  const i = setInterval(() => {
    e(`${pt}\r${ie}${Xt[n]}${E} ${s}`), n = (n + 1) % Xt.length;
  }, 80);
  return {
    update(r) {
      s = r;
    },
    succeed(r) {
      clearInterval(i), e(`${pt}\r${It}✔${E} ${r}
`);
    },
    fail(r) {
      clearInterval(i), e(`${pt}\r${de}✖${E} ${r}
`);
    },
    stop() {
      clearInterval(i);
    }
  };
}
var cr = {
  npm: de,
  pnpm: Ie,
  yarn: ar,
  bun: lr
};
function On(t, e = "npm") {
  const n = cr[e], s = t.match(/^Resolving\s+(.+?)\.{3}$/);
  if (s) return `${H}Resolving${E} ${n}${s[1]}${E}${H}...${E}`;
  const i = t.match(/^Downloading\s+(\d+)\s+package/);
  if (i) return `${H}Downloading${E} ${Ie}${i[1]}${E} ${H}packages...${E}`;
  const r = t.match(/^(?:\s*)?Fetching\s+(.+?)\.{3}$/);
  if (r) return `${H}Fetching${E} ${n}${r[1]}${E}${H}...${E}`;
  if (t.match(/^(?:\s*)?Transformed\s+(\d+)\s+file/)) return `${H}${t.trim()}${E}`;
  if (t.match(/^Installed\s+(\d+)/)) return `${It}${t}${E}`;
  const o = t.match(/^Skipping\s+(.+?)\s+\(up to date\)$/);
  return o ? `${H}Skipping${E} ${n}${o[1]}${E} ${H}(up to date)${E}` : t;
}
function Bn(t, e, n) {
  const s = `${t} package${t !== 1 ? "s" : ""}`;
  switch (n) {
    case "npm":
      return `${ge}added ${s}${E} ${H}in ${e}s${E}`;
    case "pnpm":
      return `${ge}packages:${E} ${It}+${t}${E}
${H}Done in ${e}s${E}`;
    case "yarn":
      return `${ge}${s} added${E} ${H}in ${e}s${E}`;
    case "bun":
      return `${ge}${s} installed${E} ${H}[${e}s]${E}`;
  }
}
function Z(t, e) {
  switch (e) {
    case "npm":
      return `${de}npm ERR!${E} ${t}
`;
    case "pnpm":
      return `${de} ERR_PNPM${E}  ${t}
`;
    case "yarn":
      return `${de}error${E} ${t}
`;
    case "bun":
      return `${de}error:${E} ${t}
`;
  }
}
function Ot(t, e) {
  switch (e) {
    case "npm":
      return `${Ie}npm WARN${E} ${t}
`;
    case "pnpm":
      return `${Ie} WARN${E}  ${t}
`;
    case "yarn":
      return `${Ie}warning${E} ${t}
`;
    case "bun":
      return `${Ie}warn:${E} ${t}
`;
  }
}
var ze;
function Pn() {
  return globalThis.__nodepodDeferPackSave ?? null;
}
async function Tn() {
  if (ze === void 0) try {
    const { openSnapshotCache: t } = await import("./index.mjs").then((e) => e.t);
    ze = await t();
  } catch {
    ze = null;
  }
  return ze;
}
var ur = /* @__PURE__ */ new Set([
  "--registry",
  "--prefix",
  "--cwd",
  "--cache",
  "--userconfig",
  "--globalconfig",
  "--tag",
  "--workspace",
  "-C"
]);
function Ve(t) {
  return t === "" ? "''" : /^[a-zA-Z0-9_./:@%+=,-]+$/.test(t) ? t : `'${t.replace(/'/g, "'\\''")}'`;
}
function ut(t, e) {
  return e.length ? `${Ve(t)} ${e.map(Ve).join(" ")}` : Ve(t);
}
function dr(t, e, n) {
  if (!n) return [t, e];
  const s = [t, ...e].join(" ");
  return [typeof n == "string" ? n : "/bin/sh", ["-c", s]];
}
function xt() {
  const t = globalThis.process?.env;
  if (t && typeof t == "object") return { ...t };
  if (P) try {
    return { ...P.getEnv() };
  } catch {
  }
  return {};
}
function Rn(t) {
  const e = [];
  for (let n = 0; n < t.length; n++) {
    const s = t[n];
    if (s === "--") {
      e.push(...t.slice(n + 1).filter((i) => !i.startsWith("-")));
      break;
    }
    if (s.startsWith("-")) {
      if (s.includes("=")) continue;
      ur.has(s) && n + 1 < t.length && n++;
      continue;
    }
    e.push(s);
  }
  return e;
}
async function Bt(t, e, n = "npm", s) {
  if (Oe(t)) return hr(ln(t), e, n, s);
  const { DependencyInstaller: i } = await import("./nodepod-Y98NXDvC.js").then((u) => u.M), r = await Tn(), o = new i(k, {
    cwd: e.cwd,
    snapshotCache: r,
    deferPackSave: Pn()
  });
  let l = "";
  const a = Ee ?? ((u) => {
  }), d = Date.now(), c = In(n === "bun" ? `${H}bun install${E} ${H}${J.BUN_V}${E}` : `${H}Resolving dependencies...${E}`, a);
  try {
    const u = Rn(t), h = (v) => {
      const $ = On(v, n);
      l += v + `
`, c.update($);
    }, f = t.some((v) => v === "-D" || v === "--save-dev" || v === "--dev"), p = s?.persist === !1 || t.some((v) => v === "--no-save");
    let m = cn(k, e.cwd, e.env);
    for (let v = 0; v < t.length; v++) {
      const $ = t[v];
      if ($ === "--registry" && t[v + 1]) {
        m = t[v + 1];
        break;
      }
      if ($.startsWith("--registry=")) {
        m = $.slice(11);
        break;
      }
    }
    let g = 0;
    if (u.length === 0) g = (await o.installFromManifest(void 0, {
      withDevDeps: !0,
      onProgress: h,
      registry: m
    })).newPackages.length;
    else for (const v of u) {
      const $ = await o.install(v, void 0, {
        persist: !p,
        persistDev: f && !p,
        onProgress: h,
        registry: m
      });
      g += $.newPackages.length;
    }
    const w = ((Date.now() - d) / 1e3).toFixed(1), x = Bn(g, w, n);
    return c.succeed(x), l += `added ${g} packages in ${w}s
`, {
      stdout: l,
      stderr: "",
      exitCode: 0
    };
  } catch (u) {
    const h = u instanceof Error ? u.message : String(u);
    return c.fail(`${de}${h}${E}`), {
      stdout: l,
      stderr: Z(h, n),
      exitCode: 1
    };
  }
}
async function hr(t, e, n, s) {
  const i = Rn(t).map(fr);
  if (i.length === 0) return {
    stdout: "",
    stderr: Z("-g needs a package name", n),
    exitCode: 1
  };
  const r = await Bt(t, kt(k, e), n, s);
  if (r.exitCode !== 0) return r;
  let o = r.stdout;
  for (const l of i) for (const a of fs(k, l)) o += `linked ${a} -> ${l}
`;
  return {
    ...r,
    stdout: o
  };
}
function fr(t) {
  const e = t.indexOf("@", t.startsWith("@") ? 1 : 0);
  return e > 0 ? t.slice(0, e) : t;
}
async function Nn(t, e, n = "npm") {
  if (Oe(t)) {
    const o = t.filter((l) => !l.startsWith("-"));
    for (const l of o) gs(k, l);
    return Nn(ln(t), kt(k, e), n);
  }
  const s = t.filter((o) => !o.startsWith("-"));
  if (s.length === 0) return {
    stdout: "",
    stderr: Z("Must specify package to remove", n),
    exitCode: 1
  };
  const i = Ee ?? ((o) => {
  });
  let r = "";
  for (const o of s) {
    const l = `${e.cwd}/node_modules/${o}`.replace(/\/+/g, "/");
    if (k.existsSync(l)) try {
      At(k, l);
      const d = n === "bun" ? `${H}-${E} ${o}` : n === "pnpm" ? `${de}-${E} ${o}` : `removed ${o}`;
      r += d + `
`, i(d + `
`);
    } catch (d) {
      return {
        stdout: r,
        stderr: Z(`Failed to remove ${o}: ${d instanceof Error ? d.message : String(d)}`, n),
        exitCode: 1
      };
    }
    else r += Ot(`${o} not installed`, n);
    const a = Xe(e.cwd);
    if (!("fail" in a)) {
      const d = a.pkg;
      let c = !1;
      if (d.dependencies?.[o] && (delete d.dependencies[o], c = !0), d.devDependencies?.[o] && (delete d.devDependencies[o], c = !0), c) {
        const u = `${e.cwd}/package.json`.replace(/\/+/g, "/");
        k.writeFileSync(u, JSON.stringify(d, null, 2));
      }
    }
  }
  return {
    stdout: r,
    stderr: "",
    exitCode: 0
  };
}
async function pr(t, e = "npm", n = []) {
  Oe(n) && (t = kt(k, t));
  const { DependencyInstaller: s } = await import("./nodepod-Y98NXDvC.js").then((d) => d.M), i = new s(k, { cwd: t.cwd }).listInstalled(), r = Object.entries(i);
  if (r.length === 0) return {
    stdout: `${H}(empty)${E}
`,
    stderr: "",
    exitCode: 0
  };
  const o = Xe(t.cwd), l = "fail" in o ? t.cwd : `${o.pkg.name ?? "project"}@${o.pkg.version ?? "0.0.0"}`;
  let a = "";
  switch (e) {
    case "npm":
      a += `${l} ${t.cwd}
`;
      for (let d = 0; d < r.length; d++) {
        const [c, u] = r[d], h = d === r.length - 1;
        a += `${h ? "└──" : "├──"} ${c}@${H}${u}${E}
`;
      }
      break;
    case "pnpm":
      a += `${H}Legend: production dependency, optional only, dev only${E}

`, a += `${l} ${t.cwd}

`, a += `${ge}dependencies:${E}
`;
      for (const [d, c] of r) a += `${d} ${H}${c}${E}
`;
      break;
    case "yarn":
      a += `${ge}${l}${E}
`;
      for (let d = 0; d < r.length; d++) {
        const [c, u] = r[d], h = d === r.length - 1;
        a += `${h ? "└─" : "├─"} ${c}@${ie}${u}${E}
`;
      }
      break;
    case "bun":
      for (const [d, c] of r) a += `${d}@${H}${c}${E}
`;
      a += `
${H}${r.length} packages installed${E}
`;
  }
  return {
    stdout: a,
    stderr: "",
    exitCode: 0
  };
}
async function mr(t, e, n) {
  const s = t.filter((a) => a.startsWith("-")), i = t.filter((a) => !a.startsWith("-"));
  if (e === "create" || e === "init" && i.length > 0) {
    const a = t.findIndex((p) => !p.startsWith("-")), d = t[a], c = t.slice(a + 1), u = c.indexOf("--"), h = u >= 0 ? [...c.slice(0, u), ...c.slice(u + 1)] : c;
    let f;
    if (d.startsWith("@")) f = d;
    else {
      const p = d.indexOf("@");
      p > 0 ? f = `create-${d.slice(0, p)}${d.slice(p)}` : f = `create-${d}`;
    }
    return Hn([
      "-y",
      f,
      "--",
      ...h
    ], n);
  }
  const r = `${n.cwd}/package.json`.replace(/\/+/g, "/");
  if (k.existsSync(r)) return {
    stdout: "",
    stderr: Ot("package.json already exists", "npm"),
    exitCode: 0
  };
  const o = s.includes("-y") || s.includes("--yes"), l = {
    name: n.cwd.split("/").filter(Boolean).pop() || "my-project",
    version: "1.0.0",
    description: "",
    main: "index.js",
    scripts: {
      test: 'echo "Error: no test specified" && exit 1',
      start: "node index.js"
    },
    keywords: [],
    author: "",
    license: "ISC"
  };
  return k.writeFileSync(r, JSON.stringify(l, null, 2)), {
    stdout: o ? `Wrote to ${r}
` : `Wrote to ${r}

${JSON.stringify(l, null, 2)}
`,
    stderr: "",
    exitCode: 0
  };
}
async function gr(t, e) {
  const n = t[0];
  if (!n) return {
    stdout: "",
    stderr: Z("Usage: npm info <package>", "npm"),
    exitCode: 1
  };
  const s = `/node_modules/${n}/package.json`;
  if (k.existsSync(s)) try {
    const i = JSON.parse(k.readFileSync(s, "utf8"));
    let r = `${i.name}@${i.version}
`;
    if (i.description && (r += `${i.description}
`), i.license && (r += `license: ${i.license}
`), i.homepage && (r += `homepage: ${i.homepage}
`), i.dependencies) {
      r += `
dependencies:
`;
      for (const [o, l] of Object.entries(i.dependencies)) r += `  ${o}: ${l}
`;
    }
    return {
      stdout: r,
      stderr: "",
      exitCode: 0
    };
  } catch {
  }
  try {
    const { RegistryClient: i } = await import("./registry-client-BV27YIBO.js").then((a) => a.i), r = await new i().fetchManifest(n), o = r["dist-tags"]?.latest;
    let l = `${n}@${o ?? "unknown"}
`;
    if (o && r.versions[o]) {
      const a = r.versions[o];
      a.description && (l += `${a.description}
`), a.license && (l += `license: ${a.license}
`), a.homepage && (l += `homepage: ${a.homepage}
`);
    }
    return {
      stdout: l,
      stderr: "",
      exitCode: 0
    };
  } catch {
    return {
      stdout: "",
      stderr: Z(`Not found: ${n}`, "npm"),
      exitCode: 1
    };
  }
}
async function wr(t, e = "npm") {
  const n = ts(k, t.cwd);
  if (!n || n.packages.length === 0) return {
    stdout: "",
    stderr: Z("ci can only install packages with an existing package-lock.json", e),
    exitCode: 1
  };
  const s = rs(k, t.cwd, n.packages);
  if (!s.ok) return {
    stdout: "",
    stderr: Z(`ci: ${s.reason}`, e),
    exitCode: 1
  };
  try {
    const u = `${t.cwd}/node_modules`.replace(/\/+/g, "/");
    k.existsSync(u) && At(k, u);
  } catch {
  }
  const { DependencyInstaller: i } = await import("./nodepod-Y98NXDvC.js").then((u) => u.M), r = await Tn(), o = new i(k, {
    cwd: t.cwd,
    snapshotCache: r,
    deferPackSave: Pn()
  }), l = cn(k, t.cwd, t.env);
  let a = "";
  const d = In(`${H}npm ci${E}`, Ee ?? ((u) => {
  })), c = Date.now();
  try {
    let u = 0;
    for (const p of n.packages) {
      const m = await o.install(p.name, p.version, {
        persist: !1,
        registry: l,
        lockEntry: {
          resolved: p.resolved,
          integrity: p.integrity
        },
        onProgress: (g) => {
          a += g + `
`, d.update(On(g, e));
        }
      });
      u += m.newPackages.length;
    }
    const h = ((Date.now() - c) / 1e3).toFixed(1), f = Bn(u, h, e);
    return d.succeed(f), a += `added ${u} packages in ${h}s
`, {
      stdout: a,
      stderr: "",
      exitCode: 0
    };
  } catch (u) {
    const h = u instanceof Error ? u.message : String(u);
    return d.fail(`${de}${h}${E}`), {
      stdout: a,
      stderr: Z(h, e),
      exitCode: 1
    };
  }
}
function vr(t) {
  if (!k || globalThis.__nodepodEsbuild || !t.includes("/node_modules/")) return;
  let e = t.slice(0, t.lastIndexOf("/")) || "/";
  for (let n = 0; n < 6 && e && e !== "/"; n++) {
    const s = e + "/package.json";
    if (k.existsSync(s)) {
      try {
        const i = JSON.parse(k.readFileSync(s, "utf8")), r = (o) => o in (i.dependencies ?? {}) || o in (i.optionalDependencies ?? {}) || o in (i.peerDependencies ?? {}) && !i.peerDependenciesMeta?.[o]?.optional;
        (r("esbuild") || r("esbuild-wasm")) && ks();
      } catch {
      }
      return;
    }
    e = e.slice(0, e.lastIndexOf("/")) || "/";
  }
}
async function Fe(t, e, n, s) {
  if (!k) return {
    stdout: "",
    stderr: `Volume unavailable
`,
    exitCode: 1
  };
  const i = t.startsWith("/") ? t : `${n.cwd}/${t}`.replace(/\/+/g, "/");
  let r = "";
  if (k.existsSync(i) && !k.statSync(i).isDirectory()) r = i;
  else {
    for (const $ of [
      ".js",
      ".mjs",
      ".cjs",
      ".ts",
      ".tsx",
      ".jsx"
    ]) if (k.existsSync(i + $)) {
      r = i + $;
      break;
    }
    if (!r) {
      const $ = i.endsWith("/") ? i : i + "/";
      for (const y of [
        "index.js",
        "index.mjs",
        "index.ts",
        "index.cjs"
      ]) if (k.existsSync($ + y)) {
        r = $ + y;
        break;
      }
    }
  }
  if (!r) {
    const $ = `Cannot locate module '${i}'
`, y = Se();
    return y && y($), {
      stdout: "",
      stderr: $,
      exitCode: 1
    };
  }
  vr(r);
  let o = "", l = "", a = !1, d = 0;
  const c = n.limits?.maxOutputBytes ?? 4194304;
  let u = !1;
  const h = ($) => {
    if (o.length + l.length + $.length > c)
      throw u = !0, o = "", l = `shell: output exceeds ${c} bytes
`, new Error(`shell: output exceeds ${c} bytes`);
    o += $;
    const y = ke();
    return y && y($), !0;
  }, f = ($) => {
    if (u) return !1;
    if (o.length + l.length + $.length > c)
      return u = !0, l = `shell: output exceeds ${c} bytes
`, !1;
    l += $;
    const y = Se();
    return y && y($), !0;
  }, p = globalThis.process, m = te(), g = Un({
    volume: k,
    cwd: n.cwd,
    env: n.env
  }), w = g.abortController.signal;
  g.stdoutSink = m?.stdoutSink ?? Ee, g.stderrSink = m?.stderrSink ?? rt, g.liveStdin = m?.liveStdin ?? Re, g.termCols = m?.termCols ?? lt, g.termRows = m?.termRows ?? ct;
  const x = [
    m?.abortController.signal,
    ot,
    n.signal
  ].filter(($) => !!$), v = [];
  for (const $ of new Set(x)) {
    const y = () => g.abortController.abort($.reason);
    $.aborted ? y() : ($.addEventListener("abort", y, { once: !0 }), v.push(() => $.removeEventListener("abort", y)));
  }
  Ht(g);
  try {
    const $ = new xs(k, {
      cwd: n.cwd,
      env: n.env,
      enableSharedArrayBuffer: kn,
      transformCache: Qn(),
      onConsole: (S, D) => {
        if (D.length === 1) {
          const _ = D[0];
          if (be(_) || typeof _ == "string" && _.startsWith("Error: Process exited with code")) return;
        }
        const R = ws(...D) + `
`;
        S === "error" ? f(R) : h(R);
      },
      onStdout: h,
      onStderr: f,
      workerThreadsOverride: s?.workerThreadsOverride
    }), y = $.getProcess();
    y._chdirHook = (S) => {
      P && P.setCwd(S);
    };
    let A;
    const M = new Promise((S) => {
      A = S;
    });
    if (y.exit = ((S = 0) => {
      if (jt().size > 0 && S !== 0) {
        y.exitCode = S;
        return;
      }
      throw a || (a = !0, d = S, y.emit("exit", S), A()), new Vn(S);
    }), y.argv = [
      "node",
      r,
      ...e
    ], y.execArgv = s?.execArgv?.slice() ?? [], Ge && (y.send = ((S, D) => Ge && y.connected ? (Ge(S), typeof D == "function" && D(null), !0) : !1), y.connected = !0, y.disconnect = (() => {
      y.connected && (y.connected = !1, Sn?.());
    }), !s?.workerThreadsOverride)) {
      const S = [], D = () => {
        if (y.listenerCount("message") !== 0)
          for (const R of S.splice(0)) y.emit("message", R);
      };
      y.on("newListener", (R) => {
        R === "message" && queueMicrotask(D);
      }), En((R) => {
        S.push(R), D();
      });
    }
    const B = Re, K = zi();
    if (K) {
      if (at) {
        y.stdout.isTTY = !0, y.stderr.isTTY = !0, y.stdin.isTTY = !0;
        const D = Gi(), R = Ui();
        y.stdout.columns = D, y.stdout.rows = R, y.stderr.columns = D, y.stderr.rows = R;
      }
      y.stdin.setRawMode = (D) => (y.stdin.isRaw = D, Ye && Ye(D), y.stdin), Re = y.stdin;
      const S = te();
      S && (S.liveStdin = y.stdin), vt.add(y);
    }
    const Be = !!s?.isFork;
    let X = null;
    if (Be) {
      X = Ne().register("IPCChannel", { refed: !1 });
      const S = (_) => _ === "message" || _ === "disconnect";
      y.on("newListener", (_) => {
        S(_) && X?.ref();
      }), y.on("removeListener", (_) => {
        S(_) && y.listenerCount("message") + y.listenerCount("disconnect") === 0 && X?.unref();
      });
      const D = y.disconnect, R = (_) => {
        y.connected && (_ ? D?.call(y) : y.connected = !1, X?.close(), X = null, queueMicrotask(() => y.emit("disconnect")));
      };
      y.disconnect = (() => {
        R(!0);
      }), Ke = () => R(!1), $t && ($t = !1, queueMicrotask(Ke));
    }
    let Q = null, F = !1, ne;
    const Pe = new Promise((S) => {
      ne = S;
    });
    try {
      $.runFileTLA(r, ir(r) ? { resolveDir: n.cwd } : void 0).catch((S) => {
        if (be(S)) return;
        const D = Kt(S);
        f(`Error: ${D}
`), a || (a = !0, d = 1);
      }).finally(() => {
        F = !0, ne();
      });
    } catch (S) {
      if (!be(S)) {
        const D = Kt(S);
        Q = S instanceof Error ? S : new Error(D);
      }
    }
    const T = () => {
      p && (globalThis.process = p);
    };
    if (Q) {
      T();
      const S = Q.message || Q.name || "Unknown error", D = Q.stack || "", R = D && !D.includes(S) ? `${S}
${D}` : D || S;
      return {
        stdout: o,
        stderr: l + `Error: ${R}
`,
        exitCode: 1
      };
    }
    if (a)
      return T(), {
        stdout: u ? "" : o,
        stderr: l,
        exitCode: u ? 1 : d
      };
    await new Promise((S) => qe(S, 0));
    const W = Ne(), ae = () => F ? W.activeRefedCount() > 0 : !0, V = () => {
      if (a) return d;
      const S = y.exitCode;
      return typeof S == "number" ? S : 0;
    };
    let z = !1;
    const De = async () => {
      if (z) return;
      z = !0;
      const S = V();
      try {
        y.emit("beforeExit", S);
      } catch (D) {
        if (be(D)) return;
      }
      try {
        await W.emitBeforeExit(S);
      } catch (D) {
        if (be(D)) return;
      }
      await new Promise((D) => qe(D, 0));
    };
    if (!K && !ae()) {
      if (a || await De(), !a && !ae()) {
        const S = V();
        try {
          y.emit("exit", S);
        } catch {
        }
        return T(), {
          stdout: u ? "" : o,
          stderr: l,
          exitCode: u ? 1 : S
        };
      }
      ae() && (z = !1);
    }
    const ve = /* @__PURE__ */ new WeakSet(), ye = () => {
      if (jt().size > 0) {
        typeof y.exitCode != "number" && (y.exitCode = 1);
        return;
      }
      if (!a) {
        a = !0, d = 1;
        try {
          y.emit("exit", 1);
        } catch {
        }
        A();
      }
    }, Tt = (S) => {
      S.preventDefault();
      const D = S.reason;
      if (be(D)) return;
      D != null && typeof D == "object" && ve.add(D);
      try {
        const _ = y.listenerCount ? y.listenerCount("unhandledRejection") > 0 : !1;
        if (y.emit("unhandledRejection", D, S.promise), _) return;
      } catch {
      }
      const R = D instanceof Error ? `Unhandled rejection: ${D.message}
${D.stack ?? ""}
` : `Unhandled rejection: ${String(D)}
`;
      f(R), ye();
    }, Rt = (S) => {
      S.preventDefault();
      const D = S.error ?? new Error(S.message || "Unknown error");
      if (be(D) || D != null && typeof D == "object" && ve.has(D)) return;
      D != null && typeof D == "object" && ve.add(D);
      try {
        const _ = y.listenerCount ? y.listenerCount("uncaughtException") > 0 : !1;
        if (y.emit("uncaughtException", D), _) return;
      } catch {
      }
      try {
        if (y.listenerCount && y.listenerCount("unhandledRejection") > 0) return;
      } catch {
      }
      const R = D instanceof Error ? `${D.stack || D.message}
` : `Uncaught: ${String(D)}
`;
      f(R), ye();
    }, Nt = typeof globalThis.addEventListener == "function";
    Nt && (globalThis.addEventListener("unhandledrejection", Tt), globalThis.addEventListener("error", Rt));
    try {
      const S = w ? new Promise((R) => {
        if (w.aborted) {
          R();
          return;
        }
        w.addEventListener("abort", () => R(), { once: !0 });
      }) : null;
      for (; !a && !w.aborted; ) {
        if (!F) {
          const _ = [Pe, M];
          S && _.push(S), W.activeRefedCount() > 0 ? _.push(W.drainPromise()) : _.push(new Promise((Gn) => qe(Gn, 4))), await Promise.race(_);
          continue;
        }
        if (W.activeRefedCount() === 0) {
          if (!z) {
            if (await De(), a || w.aborted) break;
            if (W.activeRefedCount() > 0) {
              z = !1;
              continue;
            }
          }
          if (await new Promise((_) => qe(_, 0)), W.activeRefedCount() > 0) {
            z = !1;
            continue;
          }
          break;
        }
        const R = [W.drainPromise(), M];
        S && R.push(S), await Promise.race(R), W.activeRefedCount() > 0 && (z = !1);
      }
      const D = V();
      if (!a) try {
        y.emit("exit", D);
      } catch {
      }
      return {
        stdout: u ? "" : o,
        stderr: l,
        exitCode: w.aborted ? 130 : u ? 1 : D
      };
    } finally {
      T(), y.exit = (() => {
      }), Nt && (globalThis.removeEventListener("unhandledrejection", Tt), globalThis.removeEventListener("error", Rt)), Re = B;
      const S = te();
      S && (S.liveStdin = B), vt.delete(y), Xn(), Zn(), Ne().closeAll(), ys();
      for (const D of v) D();
    }
  } finally {
    Ht(m);
  }
}
async function Hn(t, e) {
  if (!k) return {
    stdout: "",
    stderr: `Volume unavailable
`,
    exitCode: 1
  };
  let n = !0, s = null;
  const i = [];
  let r = !1;
  for (let c = 0; c < t.length; c++) {
    if (t[c] === "--" && !r) {
      r = !0;
      continue;
    }
    if (r || i.length > 0) {
      i.push(t[c]);
      continue;
    }
    if (t[c] === "-y" || t[c] === "--yes") {
      n = !0;
      continue;
    }
    if (t[c] === "-n" || t[c] === "--no") {
      n = !1;
      continue;
    }
    if ((t[c] === "-p" || t[c] === "--package") && c + 1 < t.length) {
      s = t[++c];
      continue;
    }
    if (t[c] === "--help" || t[c] === "-h") return {
      stdout: `${ge}Usage:${E} npx [options] <command> [args...]

${ge}Options:${E}
  ${ie}-y${E}, ${ie}--yes${E}       Auto-confirm install
  ${ie}-n${E}, ${ie}--no${E}        Don't install if not found
  ${ie}-p${E}, ${ie}--package${E}   Specify package to install
  ${ie}--${E}              Separator for command args
`,
      stderr: "",
      exitCode: 0
    };
    i.push(t[c]);
  }
  let o = i[0];
  if (!o) return {
    stdout: "",
    stderr: Z("missing command", "npm"),
    exitCode: 1
  };
  let l;
  if (o.startsWith("@")) {
    const c = o.slice(1), u = c.indexOf("@");
    u > 0 && c.indexOf("/") < u ? (l = "@" + c.slice(0, u), c.slice(u + 1)) : l = o;
  } else {
    const c = o.indexOf("@");
    c > 0 ? (l = o.slice(0, c), o.slice(c + 1)) : l = o;
  }
  const a = s || o;
  s && s.replace(/@[^@/]+$/, "").replace(/^@/, "");
  let d = en(l, k, e.cwd);
  if (!d && n) {
    const c = await Bt([a], e, "npm", { persist: !1 });
    if (c.exitCode !== 0) return c;
    d = en(l, k, e.cwd);
  }
  return d ? Fe(d, i.slice(1), e) : {
    stdout: "",
    stderr: `npx: command '${l}' not found
`,
    exitCode: 1
  };
}
function en(t, e, n) {
  const s = (t.startsWith("@"), t), i = s.includes("/") ? s.split("/").pop() : s, r = n && n !== "/" ? [`${n}/node_modules`, "/node_modules"] : ["/node_modules"];
  for (const o of r) {
    const l = `${o}/${s}/package.json`;
    if (e.existsSync(l)) try {
      const d = JSON.parse(e.readFileSync(l, "utf8"));
      if (d.bin) {
        if (typeof d.bin == "string") return `${o}/${s}/${d.bin}`;
        if (typeof d.bin == "object") {
          const c = d.bin, u = c[i] || c[s] || Object.values(c)[0];
          if (u) return `${o}/${s}/${u}`;
        }
      }
      if (d.main) return `${o}/${s}/${d.main}`;
    } catch {
    }
    const a = `${o}/.bin/${t}`;
    if (e.existsSync(a)) try {
      const d = e.readFileSync(a, "utf8").match(/node\s+"([^"]+)"/);
      if (d && e.existsSync(d[1])) return d[1];
    } catch {
    }
  }
  return null;
}
function _n(t, e, n) {
  let s = {}, i;
  typeof e == "function" ? i = e : e && (s = e, i = n);
  const r = new oe();
  if (!P) {
    const a = /* @__PURE__ */ new Error("[Nodepod] exec requires shell. Call initShellExec() first.");
    return setTimeout(() => {
      r.emit("error", a), i && i(a, "", "");
    }, 0), r;
  }
  const o = s.cwd ?? Qe(), l = s.env ?? void 0;
  return P.exec(t, {
    cwd: o,
    env: l
  }).then((a) => {
    const { stdout: d, stderr: c, exitCode: u } = a;
    if (d && r.stdout?.push(L.from(d)), c && r.stderr?.push(L.from(c)), r.stdout?.push(null), r.stderr?.push(null), r.exitCode = u, r.emit("exit", u, null), r.emit("close", u, null), i)
      if (u !== 0) {
        const h = /* @__PURE__ */ new Error(`Command failed: ${t}`);
        h.code = u, i(h, d ?? "", c ?? "");
      } else i(null, d ?? "", c ?? "");
  }, (a) => {
    r.emit("error", a instanceof Error ? a : new Error(String(a))), i && i(a instanceof Error ? a : new Error(String(a)), "", "");
  }), r;
}
function Ln(t) {
  return t == null ? [
    "inherit",
    "pipe",
    "inherit"
  ] : et(t);
}
function Ct(t, e, n, s = "") {
  const i = /* @__PURE__ */ new Error(`Command failed: ${t}
${s || n}`);
  throw i.status = e, i.stderr = L.from(s), i.stdout = L.from(n), i.output = [
    null,
    i.stdout,
    i.stderr
  ], i;
}
function yr(t, e) {
  const n = t.trim(), s = e?.encoding, i = Wn(n, e);
  if (i !== null)
    return i.status !== 0 && Ct(n, i.status, i.stdout, i.stderr ?? ""), s === "buffer" ? L.from(i.stdout) : i.stdout;
  if (!Ce) throw new Error("[Nodepod] execSync needs SharedArrayBuffer + SyncChannel. enable COOP/COEP headers, or drop `enableSharedArrayBuffer: false` from NodepodOptions.");
  const r = Ce.allocateSlot(), o = e?.cwd ?? globalThis.process?.cwd?.() ?? "/", l = e?.env ?? {};
  self.postMessage({
    type: "spawn-sync",
    requestId: jn++,
    command: n.split(/\s+/)[0],
    args: n.split(/\s+/).slice(1),
    cwd: o,
    env: l,
    syncSlot: r,
    shellCommand: n,
    stdio: Ln(e?.stdio)
  });
  const { exitCode: a, stdout: d, stderr: c } = Ce.waitForResult(r, 12e4, () => Mn(r));
  return a !== 0 && Ct(n, a, d, c), s === "buffer" ? L.from(d) : d;
}
var jn = 1;
function Mn(t) {
  self.postMessage({
    type: "sync-more",
    syncSlot: t
  });
}
var tn = {
  node: "/usr/local/bin/node",
  npm: "/usr/local/bin/npm",
  npx: "/usr/local/bin/npx",
  pnpm: "/usr/local/bin/pnpm",
  yarn: "/usr/local/bin/yarn",
  bun: "/usr/local/bin/bun",
  bunx: "/usr/local/bin/bunx",
  git: "/usr/bin/git"
};
function Fn(t) {
  const e = t.replace(/\\/g, "/");
  return /\/node_modules\/typescript\/(?:lib\/)?tsc(?:\.exe)?$/i.test(e) || /\/node_modules\/@typescript\/typescript-[^/]+\/(?:bin|lib)\/tsc(?:\.exe)?$/i.test(e) ? "[Nodepod] TypeScript 7+ requires a native compiler executable that cannot run in the browser. Pin `typescript` to 5.9.x (or use an explicitly browser-compatible compiler); Nodepod does not rewrite package versions automatically." : null;
}
function nn(t) {
  if (tn[t]) return tn[t];
  if (k) {
    const e = `/node_modules/.bin/${t}`;
    if (k.existsSync(e)) return e;
  }
  return null;
}
function mt(t) {
  if (!k) return null;
  let e = t;
  for (; ; ) {
    const n = e + "/.git";
    try {
      if (k.existsSync(n)) return {
        gitDir: n,
        workDir: e
      };
    } catch {
    }
    const s = e.substring(0, e.lastIndexOf("/")) || "/";
    if (s === e) break;
    e = s;
  }
  try {
    if (k.existsSync("/.git")) return {
      gitDir: "/.git",
      workDir: "/"
    };
  } catch {
  }
  return null;
}
function sn(t) {
  try {
    const e = k.readFileSync(t + "/HEAD", "utf8").trim();
    return e.startsWith("ref: refs/heads/") ? e.slice(16) : e.slice(0, 7);
  } catch {
    return "main";
  }
}
function rn(t) {
  try {
    const e = k.readFileSync(t + "/HEAD", "utf8").trim();
    if (e.startsWith("ref: ")) {
      const n = t + "/" + e.slice(5);
      return k.readFileSync(n, "utf8").trim();
    }
    return e;
  } catch {
    return null;
  }
}
function br(t, e) {
  try {
    const n = k.readFileSync(t + "/config", "utf8"), s = e.split(".");
    let i, r = null, o;
    if (s.length === 3)
      i = s[0], r = s[1], o = s[2];
    else if (s.length === 2)
      i = s[0], o = s[1];
    else return null;
    const l = n.split(`
`);
    let a = !1;
    for (const d of l) {
      const c = d.trim();
      if (c.startsWith("[")) {
        a = r ? c === `[${i} "${r}"]` : c === `[${i}]`;
        continue;
      }
      if (a) {
        const u = c.match(/^(\w+)\s*=\s*(.*)$/);
        if (u && u[1] === o) return u[2].trim();
      }
    }
  } catch {
  }
  return null;
}
function I(t) {
  return {
    stdout: t,
    status: 0
  };
}
function $e(t, e = 1) {
  return {
    stdout: "",
    status: e,
    stderr: t
  };
}
function Wn(t, e) {
  const n = t.trim().split(/\s+/, 1)[0]?.replace(/^['"]|['"]$/g, ""), s = n ? Fn(n) : null;
  if (s) return $e(`${s}
`, 127);
  if (/^node\s+(--version|-v)\s*$/.test(t)) return I(J.NODE + `
`);
  if (/^npm\s+(--version|-v)\s*$/.test(t)) return I(J.NPM + `
`);
  if (/^pnpm\s+(--version|-v)\s*$/.test(t)) return I(J.PNPM + `
`);
  if (/^yarn\s+(--version|-v)\s*$/.test(t)) return I(J.YARN + `
`);
  if (/^bun\s+(--version|-v)\s*$/.test(t)) return I(J.BUN + `
`);
  const i = t.match(/^(?:which|command\s+-v)\s+(\S+)\s*$/);
  if (i) {
    const a = i[1], d = nn(a);
    return d ? I(d + `
`) : $e(`/bin/sh: 1: ${a}: not found
`, 127);
  }
  const r = t.match(/^(\S+)\s+(--version|-v)\s*$/);
  if (r) {
    const a = r[1];
    if (a === "node" || a === "npm" || a === "pnpm" || a === "yarn" || a === "bun") return null;
    if (!nn(a)) return $e(`/bin/sh: 1: ${a}: not found
`, 127);
  }
  if (/^(?:npm|yarn|pnpm)\s+config\s+get\s+registry\s*$/.test(t)) return I(es.replace(/\/$/, "") + `
`);
  const o = t.match(/^echo\s+["']?(.*?)["']?\s*$/);
  if (o) return I(o[1] + `
`);
  if (/^uname\s+-s\s*$/.test(t)) return I(`Linux
`);
  if (/^uname\s+-m\s*$/.test(t)) return I(`x86_64
`);
  if (/^uname\s+-a\s*$/.test(t)) return I(`Linux nodepod 5.10.0 #1 SMP x86_64 GNU/Linux
`);
  if (/^git\s+(--version|-v)\s*$/.test(t) || t === "git --version") return I("git version " + J.GIT + `
`);
  if (k) {
    const a = t.match(/^git\s+rev-parse\s+(.+)$/);
    if (a) {
      const c = a[1].trim(), u = mt(e?.cwd || "/");
      if (c === "--show-toplevel") return I(u ? u.workDir + `
` : "");
      if (c === "--is-inside-work-tree") return I(u ? `true
` : `false
`);
      if (c === "--git-dir") return I(u ? `.git
` : "");
      if (c === "--is-bare-repository") return I(`false
`);
      if (c === "--abbrev-ref HEAD" && u) return I(sn(u.gitDir) + `
`);
      if ((c === "HEAD" || c === "--verify HEAD") && u) {
        const h = rn(u.gitDir);
        return I(h ? h + `
` : "");
      }
      if (c === "--short HEAD" && u) {
        const h = rn(u.gitDir);
        return I(h ? h.slice(0, 7) + `
` : "");
      }
    }
    if (/^git\s+branch\s+--show-current\s*$/.test(t)) {
      const c = mt(e?.cwd || "/");
      if (c) return I(sn(c.gitDir) + `
`);
    }
    const d = t.match(/^git\s+config\s+(?:--get\s+)?(\S+)\s*$/);
    if (d) {
      const c = mt(e?.cwd || "/");
      if (c) {
        const u = br(c.gitDir, d[1]);
        return I(u !== null ? u + `
` : "");
      }
      return I("");
    }
  }
  if (/^git\s/.test(t)) return $e(`fatal: '${t.replace(/^git\s+/, "").split(/\s+/)[0] || ""}' is not a sync-supported git command in Nodepod
`, 1);
  if (t === "true" || t === ":") return I("");
  if (t === "pwd") return I((e?.cwd || "/") + `
`);
  if (t.startsWith("cat ") && k) {
    const a = t.slice(4).trim().replace(/['"]/g, "");
    try {
      return I(k.readFileSync(a, "utf8"));
    } catch {
      return $e(`cat: ${a}: No such file or directory
`, 1);
    }
  }
  if ((t === "ls" || t.startsWith("ls ")) && k) {
    const a = t === "ls" ? e?.cwd || "/" : t.slice(3).trim().replace(/['"]/g, "");
    try {
      return I(k.readdirSync(a).join(`
`) + `
`);
    } catch {
      return $e(`ls: cannot access '${a}': No such file or directory
`, 1);
    }
  }
  const l = t.match(/^(?:test|\[)\s+(-[fd])\s+["']?(.*?)["']?\s*\]?\s*$/);
  if (l && k) {
    const a = l[1], d = l[2];
    try {
      const c = k.statSync(d);
      if (a === "-f" && c.isFile() || a === "-d" && c.isDirectory()) return I("");
    } catch {
    }
    return $e("", 1);
  }
  return null;
}
function et(t) {
  const e = (n) => n === "inherit" || n === "ignore" || n === "pipe" ? n : "pipe";
  if (t == null) return [
    "pipe",
    "pipe",
    "pipe"
  ];
  if (typeof t == "string") {
    const n = e(t);
    return [
      n,
      n,
      n
    ];
  }
  return Array.isArray(t) ? [
    e(t[0]),
    e(t[1]),
    e(t[2])
  ] : [
    "pipe",
    "pipe",
    "pipe"
  ];
}
function Pt(t, e, n) {
  let s = [], i = {};
  Array.isArray(e) ? (s = e, i = n ?? {}) : e && (i = e), [t, s] = dr(t, s, i.shell);
  const r = new oe(), o = Fn(t);
  if (o)
    return queueMicrotask(() => {
      r.emit("spawn"), r.stderr?.push(L.from(`${o}
`)), r.stdout?.push(null), r.stderr?.push(null), r.exitCode = 127, r.emit("exit", 127, null), r.emit("close", 127, null);
    }), r;
  const l = et(i.stdio), a = l[1] === "inherit", d = l[2] === "inherit";
  if (je) {
    const c = i.cwd ?? Qe(), u = i.env !== void 0 ? i.env : xt(), h = Ne().register("ChildProcess");
    r._elHandle = h;
    let f = !1, p = !1;
    const m = je(t, s, {
      cwd: c,
      env: u,
      stdio: l,
      onStdout: (g) => {
        if (f = !0, l[1] === "pipe" && r.stdout?.push(L.from(g)), a) {
          const w = ke();
          w && w(g);
        }
      },
      onStderr: (g) => {
        if (p = !0, l[2] === "pipe" && r.stderr?.push(L.from(g)), d) {
          const w = Se();
          w && w(g);
        }
      }
    });
    r.kill = (g = "SIGTERM") => r.exitCode !== null || r.killed ? !1 : (r.killed = !0, r.signalCode = g, m.kill?.(g) ?? !1), m.then(({ pid: g, exitCode: w, stdout: x, stderr: v }) => {
      h.close(), r.pid = g, !f && x && (r.stdout?.push(L.from(x)), a && ke()?.(x)), !p && v && (r.stderr?.push(L.from(v)), d && Se()?.(v)), r.stdout?.push(null), r.stderr?.push(null), r.exitCode = w, r.emit("exit", w, null), r.emit("close", w, null);
    }).catch((g) => {
      h.close(), r.emit("error", g instanceof Error ? g : new Error(String(g)));
    });
  } else if (P) {
    const c = i.cwd ?? Qe(), u = i.env !== void 0 ? i.env : xt(), h = ut(t, s);
    P.exec(h, {
      cwd: c,
      env: u
    }).then((f) => {
      const { stdout: p, stderr: m, exitCode: g } = f;
      p && r.stdout?.push(L.from(p)), m && r.stderr?.push(L.from(m)), r.stdout?.push(null), r.stderr?.push(null), r.exitCode = g, r.emit("exit", g, null), r.emit("close", g, null);
    }, (f) => {
      r.emit("error", f instanceof Error ? f : new Error(String(f)));
    });
  } else setTimeout(() => {
    r.emit("error", /* @__PURE__ */ new Error("[Nodepod] spawn requires shell or worker mode."));
  }, 0);
  return queueMicrotask(() => r.emit("spawn")), r;
}
function qn(t, e, n) {
  let s = [], i = {};
  Array.isArray(e) ? (s = e, i = n ?? {}) : e && (i = e);
  const r = i.shell ? [t, ...s].join(" ") : ut(t, s), o = Wn(r, {
    cwd: i.cwd,
    env: i.env
  });
  if (o !== null) {
    const u = L.from(o.stdout), h = L.from(o.stderr ?? ""), f = et(i.stdio);
    return f[1] === "inherit" && o.stdout && ke()?.(o.stdout), f[2] === "inherit" && o.stderr && Se()?.(o.stderr), {
      stdout: u,
      stderr: h,
      status: o.status,
      signal: null,
      pid: me.BASE + Math.floor(Math.random() * me.RANGE),
      output: [
        null,
        u,
        h
      ]
    };
  }
  if (!Ce) throw new Error("[Nodepod] spawnSync needs SharedArrayBuffer + SyncChannel. enable COOP/COEP headers, or drop `enableSharedArrayBuffer: false` from NodepodOptions.");
  const l = Ce.allocateSlot(), a = i.cwd ?? globalThis.process?.cwd?.() ?? "/", d = i.env !== void 0 ? i.env : xt(), c = et(i.stdio);
  self.postMessage({
    type: "spawn-sync",
    requestId: jn++,
    command: t,
    args: s,
    cwd: a,
    env: d,
    syncSlot: l,
    shellCommand: r,
    stdio: c
  });
  try {
    const { exitCode: u, stdout: h, stderr: f } = Ce.waitForResult(l, 12e4, () => Mn(l)), p = L.from(h), m = L.from(f);
    return {
      stdout: p,
      stderr: m,
      status: u,
      signal: null,
      pid: me.BASE + Math.floor(Math.random() * me.RANGE),
      output: [
        null,
        p,
        m
      ]
    };
  } catch (u) {
    const h = L.from(u?.stdout ?? ""), f = L.from(u?.stderr || u?.message || "");
    return {
      stdout: h,
      stderr: f,
      status: u?.status ?? 1,
      signal: null,
      pid: me.BASE + Math.floor(Math.random() * me.RANGE),
      output: [
        null,
        h,
        f
      ],
      error: u instanceof Error ? u : new Error(String(u))
    };
  }
}
function $r(t, e, n) {
  const s = e ?? [], i = n?.encoding, r = qn(t, s, {
    cwd: n?.cwd,
    env: n?.env,
    stdio: Ln(n?.stdio)
  });
  return (r.status !== 0 || r.error) && Ct(ut(t, s), r.status ?? 1, r.stdout?.toString() ?? "", r.stderr?.toString() ?? ""), i === "buffer" ? r.stdout : r.stdout.toString(i);
}
function zn(t, e, n, s) {
  let i = [], r = {}, o;
  Array.isArray(e) ? (i = e, typeof n == "function" ? o = n : n && (r = n, o = s)) : typeof e == "function" ? o = e : e && (r = e, o = n);
  const l = Pt(t, i, {
    cwd: r.cwd,
    env: r.env
  });
  if (o) {
    let a = "", d = "";
    l.stdout?.on("data", (c) => {
      a += typeof c == "string" ? c : L.from(c).toString();
    }), l.stderr?.on("data", (c) => {
      d += typeof c == "string" ? c : L.from(c).toString();
    }), l.once("error", (c) => {
      o(c, a, d);
    }), l.once("close", (c) => {
      if (c !== 0 && c !== null) {
        const u = /* @__PURE__ */ new Error(`Command failed: ${ut(t, i)}`);
        u.code = c, o(u, a, d);
      } else o(null, a, d);
    });
  }
  return l;
}
var xr = {
  exec(t, e) {
    return new Promise((n, s) => {
      _n(t, e ?? {}, (i, r, o) => {
        i ? (i.stdout = r, i.stderr = o, s(i)) : n({
          stdout: r,
          stderr: o
        });
      });
    });
  },
  execFile(t, e, n) {
    const s = Array.isArray(e) ? e : [], i = (Array.isArray(e) ? n : e) ?? {};
    return new Promise((r, o) => {
      zn(t, s, i, (l, a, d) => {
        l ? (l.stdout = a, l.stderr = d, o(l)) : r({
          stdout: a,
          stderr: d
        });
      });
    });
  },
  spawn(t, e, n) {
    const s = Pt(t, e, n), i = new Promise((r, o) => {
      let l = "", a = "";
      s.stdout?.on("data", (d) => {
        l += typeof d == "string" ? d : L.from(d).toString();
      }), s.stderr?.on("data", (d) => {
        a += typeof d == "string" ? d : L.from(d).toString();
      }), s.once("error", o), s.once("close", (d) => {
        if (d !== 0 && d !== null) {
          const c = /* @__PURE__ */ new Error(`Command failed: ${t}`);
          c.code = d, c.stdout = l, c.stderr = a, o(c);
        } else r({
          stdout: l,
          stderr: a
        });
      });
    });
    return Object.assign(s, {
      then: i.then.bind(i),
      catch: i.catch.bind(i),
      finally: i.finally.bind(i)
    });
  }
};
function Cr(t, e, n) {
  let s = [], i = {};
  Array.isArray(e) ? (s = e, i = n ?? {}) : e && (i = e);
  const r = i.serialization ?? "json";
  if (r !== "json" && r !== "advanced") throw new TypeError("serialization must be 'json' or 'advanced'");
  const o = i.cwd || Qe(), l = i.execArgv ?? globalThis.process?.execArgv ?? [], a = i.env || (P?.getEnv() ?? {}), d = t.startsWith("/") ? t : `${o}/${t}`.replace(/\/+/g, "/"), c = new oe();
  if (c.connected = !0, c.spawnargs = [
    "node",
    d,
    ...s
  ], c.spawnargs.splice(1, 0, ...l), c.spawnfile = "node", !yt)
    return setTimeout(() => {
      c.emit("error", /* @__PURE__ */ new Error("[Nodepod] fork requires worker mode. No forkChild callback set."));
    }, 0), c;
  const u = Ne().register("ChildProcess");
  c._elHandle = u;
  const h = yt(d, s, {
    cwd: o,
    env: a,
    serialization: r,
    execArgv: l.slice(),
    onStdout: (f) => {
      c.stdout?.emit("data", f);
      const p = ke();
      p && p(f);
    },
    onStderr: (f) => {
      c.stderr?.emit("data", f);
      const p = Se();
      p && p(f);
    },
    onIPC: (f) => {
      c.emit("message", f);
    },
    onDisconnect: () => {
      c.connected && (c.connected = !1, c.emit("disconnect"));
    },
    onExit: (f) => {
      u.close(), c.exitCode = f, c.connected = !1, c.emit("exit", f, null), c.emit("close", f, null);
    }
  });
  return c.send = (f, p) => c.connected ? (h.sendIPC(vn(f, r)), typeof p == "function" && queueMicrotask(() => p(null)), !0) : !1, c.kill = (f) => c.killed || c.exitCode !== null ? !1 : (c.killed = !0, c.connected = !1, h.kill(f ?? "SIGTERM")), c.disconnect = () => {
    c.connected = !1, h.disconnect(), c.emit("disconnect");
  }, c;
}
var oe = function() {
  this && (on.call(this), this.pid = me.BASE + Math.floor(Math.random() * me.RANGE), this.connected = !1, this.killed = !1, this.exitCode = null, this.signalCode = null, this.spawnargs = [], this.spawnfile = "", this.stdin = new Kn(), this.stdout = new _t(), this.stderr = new _t());
};
Object.setPrototypeOf(oe.prototype, on.prototype);
oe.prototype.kill = function(e) {
  return this.killed = !0, this.emit("exit", null, e ?? "SIGTERM"), !0;
};
oe.prototype.disconnect = function() {
  this.connected = !1;
};
oe.prototype.send = function(e, n) {
  return n && n(/* @__PURE__ */ new Error("IPC unavailable")), !1;
};
oe.prototype.ref = function() {
  const e = this._elHandle;
  return e && e.ref(), this;
};
oe.prototype.unref = function() {
  const e = this._elHandle;
  return e && e.unref(), this;
};
var Hr = {
  exec: _n,
  execSync: yr,
  execFile: zn,
  execFileSync: $r,
  spawn: Pt,
  spawnSync: qn,
  fork: Cr,
  promises: xr,
  ShellProcess: oe,
  initShellExec: sr,
  shellExec: tr,
  setStreamingCallbacks: Vi,
  clearStreamingCallbacks: Ji,
  sendStdin: nr,
  setSyncChannel: Zi,
  setSabEnabled: Yi,
  setSpawnChildCallback: Ki,
  setForkChildCallback: Qi,
  setIPCSend: Xi,
  setIPCReceiveHandler: En,
  handleIPCFromParent: er,
  executeNodeBinary: Fe,
  notifyTerminalResize: qi
};
export {
  oe as ShellProcess,
  Ji as clearStreamingCallbacks,
  Hr as default,
  Nr as endStdin,
  _n as exec,
  zn as execFile,
  $r as execFileSync,
  yr as execSync,
  Fe as executeNodeBinary,
  Cr as fork,
  Qe as getShellCwd,
  Fn as getUnsupportedNativeExecutableMessage,
  Pr as handleIPCDisconnect,
  er as handleIPCFromParent,
  sr as initShellExec,
  Rn as installPackageNames,
  Rr as isStdinRaw,
  qi as notifyTerminalResize,
  xr as promises,
  nr as sendStdin,
  Qi as setForkChildCallback,
  En as setIPCReceiveHandler,
  Xi as setIPCSend,
  Yi as setSabEnabled,
  Tr as setShellCwd,
  Ki as setSpawnChildCallback,
  Vi as setStreamingCallbacks,
  Zi as setSyncChannel,
  ut as shellCommandFromArgv,
  tr as shellExec,
  Ve as shellQuote,
  Pt as spawn,
  qn as spawnSync
};

//# sourceMappingURL=child_process-Bqy_wS0P.js.map