# Astro desteği

Bu fork, Nodepod'un tarayıcı içinde **Astro dev sunucusu** çalıştırmasını
destekler. Astro 7 dahil doğrulanmıştır.

## Doğrulanan sürümler

| Bileşen | Sürüm | Durum |
| --- | --- | --- |
| Astro | **7.4.4** (Vite 8 / Rolldown) | ✅ Çalışıyor (aşağıdaki 4 adım şart) |
| Astro | 5.18.2 (Vite 6) | ✅ Çalışıyor (ek adım gerekmez) |
| Node shim | 22.22.0 | ✅ (fork'ta güncellendi) |

Tarayıcıda ölçüm (Astro 7): boot + kurulum + 12 MB WASM indirme + dev + ilk
istek **~124 sn**. WASM cache'lendikten sonra belirgin şekilde düşer.

## Astro 7 için çalışan reçete

Astro 7, Vite 8'in **Rolldown** motorunu kullanır. Tarayıcıda çalışması için
dört şart vardır:

### 1. Cross-origin isolation (SharedArrayBuffer)

Rolldown'un WASM binding'i `SharedArrayBuffer` ister. Sayfa şu başlıklarla
servis edilmelidir:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

Astro sayfasında:

```astro
---
Astro.response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
Astro.response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
Astro.response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
---
```

> Üretimde bu sayfa ayrı bir origin'de (ör. `sandbox.wuppycms.com`) tutulmalı;
> COOP/COEP ana uygulamaya konursa üçüncü taraf gömüller bozulur.

### 2. Rolldown WASM binding'ini elle yerleştir

npm, `@rolldown/binding-wasm32-wasi` paketini **opsiyonel bağımlılık** olarak
atlar (`os/cpu` alanları yüzünden). Bu yüzden paket dosyaları doğrudan VFS'e
yazılır:

```ts
const dir = "/home/project/node_modules/@rolldown/binding-wasm32-wasi";
await pod.fs.mkdir(dir, { recursive: true });
for (const f of ["package.json", "rolldown-binding.wasi.cjs", "wasi-worker.mjs"]) {
  const res = await fetch(`https://unpkg.com/@rolldown/binding-wasm32-wasi@1.2.16/${f}`);
  await pod.fs.writeFile(`${dir}/${f}`, new Uint8Array(await res.arrayBuffer()));
}
const wasm = await fetch(
  "https://unpkg.com/@rolldown/binding-wasm32-wasi@1.2.16/rolldown-binding.wasm32-wasi.wasm",
);
await pod.fs.writeFile(`${dir}/rolldown-binding.wasm32-wasi.wasm`, new Uint8Array(await wasm.arrayBuffer()));
```

> Bu adım `npm install`'dan **sonra** yapılmalı (install dizini silebilir).
> Üretimde dosyalar kendi CDN'imizden servis edilmeli; unpkg yalnızca prototip.

### 3. WASI binding'ini zorla

Alt süreçte:

```ts
process.env.NAPI_RS_FORCE_WASI = "true";
process.argv = ["node", "astro", "dev", "--host", "0.0.0.0", "--port", "4321"];
await import("./node_modules/astro/bin/astro.mjs");
```

### 4. Vite host kontrolü

Vite 6/8 geliştirme sunucusu `Host` başlığı olmayan istekleri 403'ler. Proje
`astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
export default defineConfig({ vite: { server: { allowedHosts: true } } });
```

HTTP köprüsünde de başlık verilmelidir:

```ts
const res = await pod.request(4321, {
  path: "/",
  headers: { host: "localhost:4321" },
});
```

## Astro 5 için (daha hızlı)

Astro 5 (Vite 6 / esbuild + rollup) WASM binding gerektirmez; sadece:

1. `npm install`
2. `process.argv = [...]; await import("./node_modules/astro/astro.js")`
3. `allowedHosts: true` + `host` başlığı

yeterlidir (~80 sn ilk açılış).

## Doğrulama çıktısı (Astro 7)

```
probe: BINDING_OK 78
dev: "running"
REQ 200 ms=123805 hasH1=true
```

## Fork'ta yapılan düzeltmeler

1. `vite-plugin-top-level-await` kaldırıldı (Vite 8 / Rolldown ile uyumsuz;
   modern tarayıcılar TLA'yı yerel destekler).
2. Node sürümü `22.22.0` yapıldı (Astro 7'nin minimum kontrolü).
3. Üst düzey host kaydına ek olarak `setRuntimeHost(createBrowserHost())`
   çağrısı belgelendi (bundle side-effect kaybına karşı).

## Lisans

Bu fork, üst projenin lisansını korur: **MIT + Commons Clause**.
Ticari kullanım koşulları için `LICENSE` dosyasına bakın.
