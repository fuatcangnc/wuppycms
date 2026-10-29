// İçerik girdileri: frontmatter tarama (sunucu tarafı, liste için yeterli)
// ve yeni doküman içeriği üretme (şema varsayılanlarından).

import type { CollectionDef } from "@wuppycms/content-schema";

export type EntrySummary = {
	path: string;
	slug: string;
	title: string;
	/** ISO tarih ya da "" — entry listesinde gösterim için. */
	date: string;
	draft: boolean;
	/** P3: frontmatter `status` (draft/review/ready) — pano kolonları buradan. */
	status: string;
	/** Dosyaya yazan son commit (liste tablosu için). */
	lastCommit?: { sha: string; message: string; author: string; date: string };
};

/** Basit `key: value` frontmatter tarayıcısı; iç içe yapıları atlar.
 *  Anahtar deseni Unicode harf içerir (özelNot gibi anahtarlar da sayılsın). */
export function parseFrontmatterScalars(raw: string): Record<string, string> {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};
	const out: Record<string, string> = {};
	for (const line of match[1]!.split(/\r?\n/)) {
		const kv = line.match(/^([\p{L}\p{N}_-]+):\s*(.*)$/u);
		if (kv) out[kv[1]!] = kv[2]!.trim();
	}
	return out;
}

function clean(value: string | undefined): string {
	if (!value) return "";
	return value.replace(/^["'](.*)["']$/s, "$1");
}

export function toEntrySummary(path: string, extension: string, raw: string): EntrySummary {
	const fm = parseFrontmatterScalars(raw);
	const dateRaw = fm.pubDate ?? fm.date ?? fm.createdAt ?? fm.publishedAt ?? "";
	const dateMatch = dateRaw.match(/\d{4}-\d{2}-\d{2}/);
	return {
		path,
		slug: (path.split("/").pop() ?? path).replace(new RegExp(`\\.${extension}$`), ""),
		title: clean(fm.title) || clean(fm.name) || path.split("/").pop()!,
		date: dateMatch?.[0] ?? "",
		draft: /^(true|yes)$/i.test(fm.draft ?? ""),
		status: clean(fm.status).trim().toLowerCase(),
	};
}

/** Şemadan yeni doküman başlığı üretir: zorunlu/varsayılanlı alanlar dolu. */
export function buildNewEntryContent(collection: CollectionDef, title: string): string {
	const lines: string[] = [];
	lines.push(`title: ${quoteIfNeeded(title)}`);
	for (const field of collection.fields) {
		if (field.name === "title") continue;
		let value: string;
		if (field.default !== undefined) {
			value = field.default;
		} else if (!field.required) {
			continue;
		} else if (field.type === "date" || field.type === "datetime") {
			value = new Date().toISOString().slice(0, 10);
		} else if (field.type === "boolean") {
			value = "false";
		} else if (field.type === "string[]") {
			value = "[]";
		} else if (field.type === "enum") {
			value = field.options?.[0] ? `"${field.options[0]}"` : `""`;
		} else if (field.type === "number") {
			value = "0";
		} else {
			value = '""';
		}
		lines.push(`${field.name}: ${value}`);
	}
	return `---\n${lines.join("\n")}\n---\n\n`;
}

export function quoteIfNeeded(value: string): string {
	if (/^[A-Za-z0-9 .,!'()%-]+$/.test(value) && !/:\s/.test(value)) return value;
	return `"${value.replace(/"/g, '\\"')}"`;
}
