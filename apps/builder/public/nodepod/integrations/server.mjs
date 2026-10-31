import { a as n, i as r, n as p, o as s, r as m, s as c, t as d } from "../headers-Dw0SzYIb.js";
import { Buffer as o } from "node:buffer";
async function i() {
  return c(import.meta.url);
}
async function w(t) {
  const e = await i();
  return new Response(e, {
    status: 200,
    headers: n()
  });
}
async function v() {
  const t = await i(), e = n();
  return {
    body: o.from(t, "utf8"),
    headers: e,
    contentType: e["Content-Type"]
  };
}
async function f(t) {
  const e = t ? new URL(t.url).searchParams.get("mode") : null;
  return new Response(await s(import.meta.url, "html"), {
    status: 200,
    headers: r("text/html", e === "top" || e === "parent" ? e : null)
  });
}
async function h() {
  return new Response(await s(import.meta.url, "html"), {
    status: 200,
    headers: r("text/html", "top")
  });
}
async function y() {
  return new Response(await s(import.meta.url, "script"), {
    status: 200,
    headers: r("application/javascript")
  });
}
async function T(t = "html", e) {
  const a = r(t === "html" ? "text/html" : "application/javascript", e);
  return {
    body: o.from(await s(import.meta.url, t), "utf8"),
    headers: a,
    contentType: a["Content-Type"]
  };
}
export {
  d as DEFAULT_BRIDGE_HTML_PATH,
  p as DEFAULT_BRIDGE_SCRIPT_PATH,
  m as DEFAULT_SW_PATH,
  i as getServiceWorkerSource,
  h as servePreviewBootstrap,
  f as servePreviewBridge,
  T as servePreviewBridgeNode,
  y as servePreviewBridgeScript,
  w as serveSW,
  v as serveSWNode
};

//# sourceMappingURL=server.mjs.map