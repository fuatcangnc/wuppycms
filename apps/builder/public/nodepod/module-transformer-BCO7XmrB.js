import { d as x } from "./event-loop-CGuYUIBq.js";
import { a as j, i as w, n as T, o as S } from "./offload-DgyAYqvz.js";
import { i as b, n as E } from "./esbuild-engine-BdHL_6AU.js";
var R = 1048576;
function v(t, e = 64, n = R) {
  const r = [];
  let a = [], i = 0;
  for (const c of t) {
    const f = c.source.length;
    a.length > 0 && (a.length >= e || i + f > n) && (r.push(a), a = [], i = 0), a.push(c), i += f;
  }
  return a.length > 0 && r.push(a), r;
}
var B = [
  /<[A-Z][a-zA-Z0-9.]*[\s/>]/,
  /<\/[a-zA-Z]/,
  /\/>/,
  /<>|<\/>/,
  /React\.createElement\b/,
  /jsx\(|jsxs\(|jsxDEV\(/
];
function F(t) {
  return B.some((e) => e.test(t));
}
var $ = /* @__PURE__ */ x({
  convertFileDirect: () => k,
  convertPackage: () => L,
  patchBuiltinImports: () => m,
  prepareTransformer: () => P
}), p = typeof window < "u", d = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "net",
  "os",
  "path",
  "perf_hooks",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
  "async_hooks",
  "inspector",
  "module"
].join("|"), A = new RegExp(`\\bimport\\s*\\(\\s*["']((?:node:)?(?:${d}))["']\\s*\\)`, "g"), I = new RegExp(`\\bimport\\s*\\(\\s*["'](?:node:)?(?:${d})["']`);
async function P() {
  p && await b();
}
function h(t, e) {
  return t.endsWith(".jsx") ? "jsx" : t.endsWith(".ts") ? "ts" : t.endsWith(".tsx") ? "tsx" : t.endsWith(".mjs") ? "js" : F(e) ? "jsx" : "js";
}
async function k(t, e) {
  if (!p) return t;
  const n = await E();
  try {
    return await W(n.engine, t, e);
  } finally {
    n.release(t.length);
  }
}
async function W(t, e, n) {
  const r = h(n, e);
  try {
    return m((await t.transform(e, {
      loader: r,
      format: "cjs",
      target: "esnext",
      platform: "neutral",
      define: {
        "import.meta.url": "import_meta.url",
        "import.meta.dirname": "import_meta.dirname",
        "import.meta.filename": "import_meta.filename",
        "import.meta": "import_meta"
      }
    })).code);
  } catch (a) {
    const i = a instanceof Error ? a.message : String(a);
    if (r === "js" || r === "jsx") {
      const c = r === "js" ? [
        "jsx",
        "tsx",
        "ts"
      ] : ["tsx"];
      for (const f of c) try {
        return m((await t.transform(e, {
          loader: f,
          format: "cjs",
          target: "esnext",
          platform: "neutral",
          define: {
            "import.meta.url": "import_meta.url",
            "import.meta.dirname": "import_meta.dirname",
            "import.meta.filename": "import_meta.filename",
            "import.meta": "import_meta"
          }
        })).code);
      } catch {
      }
    }
    if (i.includes("Top-level await")) try {
      return m((await t.transform(e, {
        loader: r,
        format: "esm",
        target: "esnext",
        platform: "neutral",
        define: {
          "import.meta.url": "import_meta.url",
          "import.meta.dirname": "import_meta.dirname",
          "import.meta.filename": "import_meta.filename",
          "import.meta": "import_meta"
        }
      })).code);
    } catch {
      return m(e);
    }
    return m(e);
  }
}
function O(t, e) {
  return t.endsWith(".mjs") || t.endsWith(".cjs") ? !1 : /\bimport\s+[\w{*'"]/m.test(e) || /\bexport\s+(?:default|const|let|var|function|class|{|\*)/m.test(e) || /\bimport\.meta\b/.test(e);
}
function u(t) {
  return I.test(t);
}
function m(t) {
  return t.replace(A, (e, n) => `Promise.resolve(require("${n}"))`);
}
function _(t, e) {
  const n = [];
  try {
    for (const r of t.readdirSync(e)) {
      const a = e + "/" + r;
      try {
        t.statSync(a).isDirectory() ? r !== "node_modules" && n.push(..._(t, a)) : (r.endsWith(".js") || r.endsWith(".mjs") || r.endsWith(".jsx")) && n.push(a);
      } catch {
      }
    }
  } catch {
  }
  return n;
}
function N(t, e) {
  try {
    const n = e + "/package.json";
    if (t.existsSync(n)) {
      const r = t.readFileSync(n, "utf8");
      return JSON.parse(r).type === "module";
    }
  } catch {
  }
  return !1;
}
async function L(t, e, n, r) {
  const a = r?.begin("modules.transform", {
    category: "modules",
    metadata: { path: e }
  }) ?? null;
  let i = 0;
  const c = _(t, e);
  n?.(`  Converting ${c.length} files in ${e}...`);
  const f = N(t, e), l = [];
  for (const s of c) try {
    const o = t.readFileSync(s, "utf8");
    if (f || s.endsWith(".mjs")) {
      u(o) && (t.writeFileSync(s, m(o)), i++);
      continue;
    }
    O(s, o) ? l.push({
      filePath: s,
      source: o,
      loader: h(s, o)
    }) : u(o) && (t.writeFileSync(s, m(o)), i++);
  } catch {
  }
  const y = v(l).map((s) => ({
    type: "transformBatch",
    id: j(),
    files: s,
    options: {
      format: "cjs",
      target: "esnext",
      platform: "neutral",
      define: {
        "import.meta.url": "import_meta.url",
        "import.meta.dirname": "import_meta.dirname",
        "import.meta.filename": "import_meta.filename",
        "import.meta": "import_meta"
      }
    },
    priority: S.NORMAL
  })), g = await Promise.all(y.map((s) => r ? w(s, r) : T(s)));
  for (const s of g) for (const o of s.results) try {
    t.writeFileSync(o.filePath, o.code), i++;
  } catch {
  }
  return r?.count("modules.transformedFiles", i), r?.end(a), i;
}
export {
  $ as n,
  P as r,
  L as t
};

//# sourceMappingURL=module-transformer-BCO7XmrB.js.map