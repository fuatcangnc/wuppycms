// Yerelleştirme denetleyicisi (docs/i18n.md) — her locale dosyasını kaynak
// tr.yaml'a karşı doğrular: anahtar kümesi BİREBİR, {parametre} adları aynı,
// boş değer yok, dosya sonunda satır sonu var. Hatalıysa çıkış kodu 1.
//
// Koşum: node scripts/check-locales.mjs

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const LOCALES_DIR = fileURLToPath(new URL("../src/lib/locales/", import.meta.url));
const SOURCE = "tr";

/** İç içe ağacı { "a.b": "değer" } düz sözlüğüne çevirir. */
function flatten(tree, prefix = "") {
	const out = {};
	for (const [name, value] of Object.entries(tree ?? {})) {
		const path = prefix ? `${prefix}.${name}` : name;
		if (typeof value === "string") out[path] = value;
		else if (value && typeof value === "object") Object.assign(out, flatten(value, path));
	}
	return out;
}

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const files = readdirSync(LOCALES_DIR).filter((name) => name.endsWith(".yaml"));
const catalogs = {};
for (const file of files) {
	const code = file.replace(/\.yaml$/, "");
	const raw = readFileSync(`${LOCALES_DIR}${file}`, "utf8");
	catalogs[code] = { raw, flat: flatten(parse(raw)) };
}

if (!catalogs[SOURCE]) {
	console.error(`Kaynak dil dosyası yok: ${SOURCE}.yaml`);
	process.exit(1);
}

const sourceKeys = Object.keys(catalogs[SOURCE].flat).sort();
let errors = 0;

for (const [code, { raw, flat }] of Object.entries(catalogs)) {
	const fail = (message) => {
		console.error(`  ✗ ${code}: ${message}`);
		errors += 1;
	};

	if (!raw.endsWith("\n")) fail("dosya satır sonuyla bitmiyor");

	if (code !== SOURCE) {
		const keys = Object.keys(flat).sort();
		for (const key of sourceKeys) {
			if (!(key in flat)) fail(`eksik anahtar: ${key}`);
		}
		for (const key of keys) {
			if (!(key in catalogs[SOURCE].flat)) fail(`kaynakta olmayan anahtar: ${key}`);
		}
	}

	for (const [key, value] of Object.entries(flat)) {
		if (value.trim() === "") fail(`boş değer: ${key}`);
		const source = catalogs[SOURCE].flat[key];
		if (source === undefined) continue;
		const expected = placeholders(source).join(",");
		const actual = placeholders(value).join(",");
		if (expected !== actual) {
			fail(`${key}: yer tutucular uyuşmuyor (beklenen: {${expected || "yok"}} · bulunan: {${actual || "yok"}})`);
		}
	}
}

if (errors > 0) {
	console.error(`\n${errors} sorun bulundu.`);
	process.exit(1);
}
console.log(`${files.length} dil dosyası doğrulandı (${sourceKeys.length} anahtar, kaynak: ${SOURCE}).`);
