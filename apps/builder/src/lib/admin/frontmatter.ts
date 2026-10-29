// Frontmatter oku/yaz — alan sırasını ve şema dışı anahtarları korur.
// Yorum satırları ve iç içe bloklar ham değer olarak taşınır.

import type { FieldType } from "@wuppycms/content-schema";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export type ParsedDoc = {
	/** Anahtar sırası (dosyadaki gibi). */
	order: string[];
	/** Anahtar → ham YAML değeri (tek satıra katlanmış). */
	values: Map<string, string>;
	body: string;
	hasFrontmatter: boolean;
};

export function parseDoc(raw: string): ParsedDoc {
	const match = raw.match(FRONTMATTER_RE);
	const order: string[] = [];
	const values = new Map<string, string>();
	if (!match) return { order, values, body: raw, hasFrontmatter: false };

	for (const line of match[1]!.split(/\r?\n/)) {
		if (!line.trim() || /^\s*#/.test(line)) continue;
		// Anahtar deseni Unicode harf içerir: "özelNot", "yayınTarihi" gibi
		// Türkçe/Unicode anahtarlar da üst-seviye sayılmalı; yoksa önceki
		// değere yapışıp frontmatter'ı bozuyordu (E2E'nin yakaladığı hata).
		const top = line.match(/^([\p{L}\p{N}_$.-]+)\s*:\s?(.*)$/u);
		if (top && !line.startsWith(" ") && !line.startsWith("\t")) {
			order.push(top[1]!);
			values.set(top[1]!, top[2]!);
		} else if (order.length > 0) {
			// girintili devam satırı (blok dizi/nesne) → önceki değere ekle
			const last = order[order.length - 1]!;
			values.set(last, `${values.get(last)}\n${line}`);
		}
	}
	return { order, values, body: raw.slice(match[0].length), hasFrontmatter: true };
}

/** Frontmatter gövdesini (--- sınırları olmadan) yeniden üretir — YAML paneli. */
export function frontmatterText(order: string[], values: Map<string, string>): string {
	return order.map((key) => `${key}: ${values.get(key) ?? ""}`).join("\n");
}

export function serializeDoc(
	order: string[],
	values: Map<string, string>,
	body: string,
): string {
	if (order.length === 0 && !values.size) return body;
	const lines = order
		.filter((key, i) => order.indexOf(key) === i)
		.map((key) => `${key}: ${values.get(key) ?? ""}`);
	return `---\n${lines.join("\n")}\n---\n${body}`;
}

// --- ham YAML ↔ form görüntüsü -----------------------------------------------

function unquote(value: string): string {
	if (/^"(.*)"$/s.test(value)) {
		return value
			.slice(1, -1)
			.replace(/\\n/g, "\n")
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\");
	}
	if (/^'(.*)'$/s.test(value)) return value.slice(1, -1).replace(/''/g, "'");
	return value;
}

/** Akış dizisini ("[a, b]") metne çevirir; blok diziyi ("a\n- b" satırları) da. */
function flowArrayToText(value: string): string {
	const lines = value.split("\n").map((l) => l.trim());
	if (/^\[.*\]$/s.test(lines[0]!)) {
		return lines[0]!
			.slice(1, -1)
			.split(",")
			.map((item) => unquote(item.trim()))
			.filter(Boolean)
			.join(", ");
	}
	return lines
		.filter((l) => l.startsWith("- "))
		.map((l) => unquote(l.slice(2).trim()))
		.filter(Boolean)
		.join(", ");
}

/** Ham YAML değerini form alanına gösterilebilir metne çevirir. */
export function rawToDisplay(raw: string | undefined, type: FieldType): string {
	if (raw === undefined) return "";
	const trimmed = raw.trim();
	switch (type) {
		case "string[]":
			return flowArrayToText(trimmed);
		case "boolean":
			return /^(true|yes)$/i.test(unquote(trimmed)) ? "true" : "false";
		case "datetime": {
			const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
			return m ? `${m[1]}T${m[2]}` : trimmed;
		}
		case "date": {
			const m = trimmed.match(/\d{4}-\d{2}-\d{2}/);
			return m?.[0] ?? "";
		}
		case "json":
			return trimmed;
		default:
			return unquote(trimmed);
	}
}

function needsQuotes(value: string): boolean {
	if (value === "") return true;
	if (/[:#]\s|^[-?:,[\]{}#&*!|>'"%@`]|:\s|\s$/.test(value)) return true;
	if (/^(true|false|yes|no|on|off|null|~|\d+(\.\d+)?)$/i.test(value)) return true;
	return false;
}

/** Form değerini dosyaya yazılacak ham YAML'a çevirir. */
export function displayToRaw(display: string, type: FieldType): string {
	switch (type) {
		case "boolean":
			return display === "true" ? "true" : "false";
		case "string[]": {
			const items = display
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean);
			if (items.length === 0) return "[]";
			return `[${items.map((i) => (needsQuotes(i) ? `"${i.replace(/"/g, '\\"')}"` : i)).join(", ")}]`;
		}
		case "json":
			return display.trim() || "{}";
		default: {
			if (display.includes("\n")) {
				const escaped = display
					.replace(/\\/g, "\\\\")
					.replace(/"/g, '\\"')
					.replace(/\n/g, "\\n");
				return `"${escaped}"`;
			}
			return needsQuotes(display) ? `"${display.replace(/"/g, '\\"')}"` : display;
		}
	}
}
