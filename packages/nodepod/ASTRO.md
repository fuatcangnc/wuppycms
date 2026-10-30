# Astro desteği

Bu fork, Nodepod'un tarayıcı içinde **Astro dev sunucusu** çalıştırmasını
destekler ve doğrulanmıştır.

## Doğrulanan sürüm

| Bileşen | Sürüm | Durum |
| --- | --- | --- |
| Astro | **5.18.2** (Vite 6 / esbuild + rollup) | ✅ Çalışıyor |
| Astro | 7.x (Vite 8 / Rolldown) | ❌ Rolldown WASM binding + `node:wasi` gerekli |
| Node shim | 22.22.0 | ✅ (fork'ta güncellendi) |

Tarayıcıda ölçüm: boot + `npm install` + `astro dev` + ilk istek **~80 sn**
(cache'li kurulumda ~20 sn).

## Çalışan reçete

```ts
import { Nodepod, createBrowserHost, setRuntimeHost } from "@wuppycms/nodepod";

// Host kaydı açıkça yapılır: üst düzey side-effect bazı bundler'larda düşüyor.
setRuntimeHost(createBrowserHost());

const pod = await Nodepod.boot({
  serviceWorker: false,
  workdir: "/home/project",
  files: {
    "/home/project/package.json": JSON.stringify({
      name: "site",
      private: true,
      type: "module",
      dependencies: { astro: "^5.14.0" },
    }),
    // Vite 6 geliştirme sunucusu Host başlığı olmayan istekleri 403'ler.
    "/home/project/astro.config.mjs":
      `import { defineConfig } from "astro/config";\nexport default defineConfig({ vite: { server: { allowedHosts: true } } });\n`,
    "/home/project/src/pages/index.astro":
      `---\nconst msg = "Merhaba"\n---\n<html><body><h1>{msg}</h1></body></html>`,
  },
});

const install = await pod.spawn("npm", ["install", "--no-audit", "--no-fund"]);
install.on("output", console.log);
await install.completion;

const dev = await pod.spawn("npm", ["run", "dev"]); // "astro dev --host 0.0.0.0 --port 4321"
dev.on("output", console.log);

// HTTP köprüsü: Host başlığı ZORUNLU (Vite allowedHosts kontrolü).
const res = await pod.request(4321, {
  path: "/",
  headers: { host: "localhost:4321" },
});
console.log(res.statusCode, new TextDecoder().decode(res.body));
```

## Iframe / önizleme

- `pod.request` programatik çalışır (yukarıdaki örnek).
- Gerçek iframe önizlemesi için Nodepod'un service worker'ı gerekir:
  - `Nodepod.boot({ serviceWorker: true })`
  - `dist/__sw__.js` ve `dist/__worker__.js` aynı origin'den yayınlanmalı.
  - Önizleme isteklerinde `Host` başlığını `localhost:<port>` yapan bir köprü
    kullanılmalı; aksi halde Vite 403 döner.

## Fork'ta yapılan düzeltmeler

1. `vite-plugin-top-level-await` kaldırıldı (Vite 8 / Rolldown ile uyumsuz;
   modern tarayıcılar TLA'yı yerel destekler).
2. Node sürümü `22.22.0` yapıldı (Astro 7'nin minimum kontrolü için; Astro 5
   zaten çalışıyor).
3. Üst düzey host kaydına ek olarak `setRuntimeHost(createBrowserHost())`
   çağrısı belgelendi (bundle side-effect kaybına karşı).

## Astro 7 için kalan iş

Astro 7, Vite 8'in **Rolldown** motorunu kullanır. Tarayıcıda çalışması için:

1. `@rolldown/binding-wasm32-wasi` paketinin npm opsiyonel bağımlılık
   atlamasına takılmadan kurulması,
2. `node:wasi` + `node:worker_threads` üzerinde WASM binding'in çalıştırılması,
3. Muhtemelen `SharedArrayBuffer` (COOP/COEP) gereksinimi.

Bu üç madde çözülene kadar tarayıcı önizlemesi için **Astro 5 (Vite 6)**
önerilir. Üretim/derleme tarafı Astro 7 ile çalışmaya devam eder; yalnızca
tarayıcı önizlemesi Astro 5'e sabitlenir.

## Lisans

Bu fork, üst projenin lisansını korur: **MIT + Commons Clause**.
Ticari kullanım koşulları için `LICENSE` dosyasına bakın.
