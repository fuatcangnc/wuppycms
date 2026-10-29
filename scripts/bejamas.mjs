#!/usr/bin/env node
// Bejamas UI registry getiricisi — port öncesi kaynak çıkışı.
//
//   node scripts/bejamas.mjs list              → tüm kayıt adları
//   node scripts/bejamas.mjs tooltip popover   → .astro kaynaklarını yazdır
//   node scripts/bejamas.mjs tooltip --out /tmp/x → dosyalara yaz
//
// Çıkan sınıflar `src/components/ui-react/<ad>/` portuna birebir taşınır.

const BASE = "https://ui.bejamas.com/r";

const args = process.argv.slice(2);
if (!args.length) {
	console.error("kullanım: bejamas.mjs <list|ad…> [--out dizin]");
	process.exit(1);
}

const json = async (name) => {
	const res = await fetch(`${BASE}/${name}.json`);
	if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
	return res.json();
};

if (args[0] === "list") {
	const index = await json("index");
	const items = Array.isArray(index) ? index : index.items ?? index.registry ?? [];
	for (const item of items) console.log(item.name);
	process.exit(0);
}

const outAt = args.indexOf("--out");
const outDir = outAt >= 0 ? args[outAt + 1] : null;
const names = args.filter((a, i) => !a.startsWith("--") && i !== outAt + 1);

for (const name of names) {
	const entry = await json(name);
	for (const file of entry.files ?? []) {
		const path = `${outDir ?? ""}${outDir ? "/" : ""}${name}/${file.path}`;
		if (outDir) {
			const { mkdirSync, writeFileSync } = await import("node:fs");
			mkdirSync(path.split("/").slice(0, -1).join("/"), { recursive: true });
			writeFileSync(path, file.content);
			console.log(path);
		} else {
			console.log(`\n===== ${name}/${file.path.split("/").pop()} =====\n${file.content}`);
		}
	}
}
