// CloudFront viewer-request fonksiyonu — çok kiracılı yayın (ADR 0022).
//
// Tek dağıtım, tek sertifika, `*.sites.wuppycms.com`. Gelen isteğin Host
// başlığından slug okunur ve URI `sites/<slug>/...` olarak yeniden yazılır.
// Yeni site = S3'te yeni klasör → yeni dağıtım/DNS gerekmez.
//
// Klasör yolları (`/hakkimizda/`) ve uzantısız yollar `index.html`e çözülür;
// bulunamayan yollar `404/index.html`e düşer (Astro statik çıktısı).

function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;
  if (!host) return request;

  var baseDomain = "sites.wuppycms.com";
  var hostname = host.split(":")[0].toLowerCase();
  if (hostname === baseDomain) {
    // Taban alan adı: bilgilendirme sayfası yerine 404.
    return { statusCode: 404, statusDescription: "Not Found" };
  }
  if (hostname.slice(-(baseDomain.length + 1)) !== "." + baseDomain) {
    return request;
  }
  var slug = hostname.slice(0, -(baseDomain.length + 1));
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) {
    return { statusCode: 404, statusDescription: "Not Found" };
  }

  var uri = request.uri || "/";
  var prefix = "/sites/" + slug;

  // Zaten önekli gelmişse (proxy üzerinden) dokunma.
  if (uri.indexOf(prefix + "/") === 0) {
    return request;
  }

  if (uri === "/" || uri === "") {
    request.uri = prefix + "/index.html";
  } else if (uri.slice(-1) === "/") {
    request.uri = prefix + uri + "index.html";
  } else {
    var lastSegment = uri.split("/").pop();
    if (lastSegment.indexOf(".") === -1) {
      request.uri = prefix + uri + "/index.html";
    } else {
      request.uri = prefix + uri;
    }
  }

  return request;
}
