import { a as o, i, n as d, o as p, r as n, s as c, t as _ } from "../headers-Dw0SzYIb.js";
var m = n, h = [
  n,
  _,
  d
];
async function a() {
  const { NextResponse: e } = await import("next/server");
  return new e(await c(import.meta.url), {
    status: 200,
    headers: o()
  });
}
async function t(e, r) {
  const { NextResponse: s } = await import("next/server");
  return new s(await p(import.meta.url, e), {
    status: 200,
    headers: i(e === "html" ? "text/html" : "application/javascript", r)
  });
}
async function E() {
  return a();
}
async function R(e) {
  const r = e?.nextUrl.searchParams?.get("mode");
  return t("html", r === "top" || r === "parent" ? r : null);
}
async function T() {
  return t("script");
}
async function u(e) {
  if (e.nextUrl.pathname === "/__sw__.js") return a();
  if (e.nextUrl.pathname === "/__nodepod_bridge__.html") {
    const r = e.nextUrl.searchParams?.get("mode");
    return t("html", r === "top" || r === "parent" ? r : null);
  }
  return e.nextUrl.pathname === "/__nodepod_bridge__.js" ? t("script") : null;
}
var w = u;
export {
  E as GET,
  R as GET_PREVIEW_BRIDGE,
  T as GET_PREVIEW_BRIDGE_SCRIPT,
  m as nodepodMatcher,
  h as nodepodMatchers,
  w as nodepodMiddleware,
  u as nodepodProxy
};

//# sourceMappingURL=next.mjs.map