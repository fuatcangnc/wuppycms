# WuppyCMS Demo Sitesi

WuppyCMS şablonuyla kurulmuş örnek site. İçerik bu repoda yaşar; WuppyCMS CMS'te
yapılan her kayıt gerçek bir commit'tir, build GitHub Actions'ta koşar.

Tasarım sözleşmesi: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — token'lar
`src/styles/global.css`ten gelir; primitifler Bejamas UI'dandır (NavigationMenu,
Accordion, Tabs, Carousel, Button). Tasarım dili `karakas/cantaproje`
referansından uyarlanmıştır: açık zemin, `#dd641e` turuncu, Space Grotesk,
keskin köşe ve endüstriyel dot-matrix detayları.

## Yapı

| Yol | Ne var? |
| --- | --- |
| `src/content/blog/*.mdx` | Blog yazıları (frontmatter + MDX gövde) |
| `src/content/authors/*.md` | Yazarlar |
| `src/content.config.ts` | Zod şemaları — koleksiyonların gerçek kaynağı |
| `.wuppycms/sites.jsonc` | Site tanımları (CMS buradan okur) |
| `.github/workflows/build.yml` | CI: her push'ta `pnpm build` |
| `src/ui/*` | Bejamas UI primitifleri (navigation-menu, accordion, tabs, carousel) |
| `src/components/*` | Header, footer, hero pipeline, paneller, süreç, blog kartları |
| `src/pages/index.astro` | Endüstriyel landing: hero, özellikler, süreç, blog, iletişim |
| `src/pages/blog/*` | Blog indeksi ve makale şablonu |

## Geliştirme

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build
```
