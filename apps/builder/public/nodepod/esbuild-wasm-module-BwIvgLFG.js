import { d as o } from "./event-loop-CGuYUIBq.js";
import { n as a } from "./cdn-urls-BV1eSMdl.js";
var b = /* @__PURE__ */ o({
  getSharedEsbuildModule: () => n,
  prefetchSharedEsbuildModule: () => s,
  requestEsbuildPrefetch: () => d
}), l = null, i = !1, r = null, f = 1e4;
function u() {
  r && clearTimeout(r), r = setTimeout(() => {
    r = null, i ? u() : l = null;
  }, f);
}
async function c(e) {
  if (typeof WebAssembly > "u" || typeof fetch != "function") return null;
  try {
    const t = await fetch(e);
    return t.ok ? typeof WebAssembly.compileStreaming == "function" && /^application\/wasm($|;)/i.test(t.headers.get("content-type") || "") ? await WebAssembly.compileStreaming(t) : await WebAssembly.compile(await t.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
function n() {
  return Promise.resolve(null);
}
function s() {
  n();
}
function d() {
  const e = globalThis.__nodepodRequestEsbuildModule;
  e ? e().catch(() => {
  }) : typeof document < "u" && s();
}
export {
  d as i,
  n,
  s as r,
  b as t
};

//# sourceMappingURL=esbuild-wasm-module-BwIvgLFG.js.map