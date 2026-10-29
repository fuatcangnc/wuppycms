# 0003 — Admin URL düzeni: GitCMS biçimi yol + kısa site kimliği

Durum: Superseded by 0005 (adres BİÇİMİ aynen geçerli; uygulama sahibi artık react-router)

## Bağlam

Adres; derin bağlantı, geri/ileri dolaşımı ve paylaşımı mümkün kılmalı ve
rakip GitCMS'in adres biçimini yansıtmalı: yolda site kuyruğu + gerçek
klasör/belge yolu, sorguda kısa site kimliği ve kitaplık anahtarı. Astro dosya
yönlendirmesi bu gereği tek adacık + anlık durum eşitlemesiyle (0001) birlikte
karşılayamaz.

## Karar

`src/lib/admin/router.ts` istemci taraflı History API yönlendiricisidir:

```text
/admin/{repo-kuyruğu}                              genel bakış
/admin/{repo-kuyruğu}/content/{koleksiyon}         kayıt listesi
/admin/{repo-kuyruğu}/content/{koleksiyon}/{slug}  doküman
/admin/{repo-kuyruğu}/content-md                   CONTENT.md
/admin/{repo-kuyruğu}/media/{klasör…}              medya
?site={proje-UUID}                                 gerçek site seçici
&mediaLibrary=repo_media|platform_r2               kitaplık
```

- Yol, Nanostores durumundan `pathFor()` ile üretilir; `applyLocation()`
  adresi okuyup store'a uygular. İlk eşitleme `replaceState`, sonrakiler
  `pushState` (`ready` kapısı).
- Nanostores `listen()` değil `subscribe()` kullanılır (`listen` abone anında
  tetiklenip geçmiş kirletir).
- Eski adreslar okunmaya devam eder ve normalize edilir: `/cms`, `/c/…`,
  `/d/…`, `?site=repo%2Fad&folder=…`.

## Sonuçlar

- Yeni bir görünüm eklerken `pathFor()` + `applyLocation()` çifti güncellenir;
  `router.test.ts` sözleşmeyi kilitler.
- SEO gerekmez (auth'lu panel), dolayısıyla prerender gerekmez.
