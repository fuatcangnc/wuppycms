// Müşteri reposundaki `src/content.config.ts` (Astro content layer + Zod)
// tek doğruluk kaynağıdır. Bu paket o dosyayı ÇALIŞTIRMADAN metin olarak
// çözümler ve CMS formunu besleyen alan tanımlarına çevirir.
//
// Beklenen biçim (site-template şablonumuzla birebir):
//
//	 const blog = defineCollection({
//	   loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
//	   schema: z.object({ title: z.string(), pubDate: z.coerce.date(), ... }),
//	 });
//
// Desteklenmeyen ifadeler `json` alanına düşer — veri kaybı olmaz, editör
// ham değeri gösterir.

export type FieldType =
	| "string"
	| "richtext"
	| "number"
	| "boolean"
	| "date"
	| "datetime"
	| "enum"
	| "string[]"
	| "json";

export type FieldDef = {
	name: string;
	label: string;
	type: FieldType;
	required: boolean;
	/** Zod `.default(...)` değeri; form yeni doküman üretirken kullanır. */
	default?: string;
	options?: string[];
};

export type CollectionDef = {
	/** `const blog = …` içindeki değişken adı. */
	key: string;
	/** Gösterim adı (key'in baş harfli hâli). */
	name: string;
	/** glob tabanı, ör. `src/content/blog` (repo köküne göre). */
	base: string;
	/** Dosya uzantısı, ör. `mdx`. */
	extension: string;
	fields: FieldDef[];
};

/** Astro'nun içerik yapılandırma dosyasının standart yolu. */
export const CONTENT_CONFIG_PATH = "src/content.config.ts";

/** Uzun metin kabul eden alan adları → textarea. */
const MULTILINE_FIELDS = new Set([
	"description",
	"excerpt",
	"summary",
	"bio",
	"intro",
	"introduction",
	"text",
	"body",
	"content",
	"ozet",
	"aciklama",
]);

function displayKey(key: string): string {
	return key.charAt(0).toUpperCase() + key.slice(1);
}

/** `open` indeksinden itibaren süslü parantez/parantez derinliğini sayarak
 *  eşleşen kapanışın bir sonrasını döndürür. Bulamazsa -1. */
function matchBrace(text: string, open: number, pairs = "{}"): number {
	const [o, c] = [pairs[0]!, pairs[1]!];
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		const ch = text[i];
		if (ch === o) depth++;
		else if (ch === c) {
			depth--;
			if (depth === 0) return i + 1;
		}
	}
	return -1;
}

function firstStringLiteral(text: string, key: string): string | null {
	const re = new RegExp(`${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)`);
	const m = text.match(re);
	if (!m) return null;
	return m[1] ?? m[2] ?? m[3] ?? null;
}

function extractQuotedList(expr: string): string[] {
	return [...expr.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]!);
}

/** `.default(...)` ifadesinin içindeki ham değeri dengeli parantezle alır. */
function extractDefault(expr: string): string | undefined {
	const at = expr.indexOf(".default(");
	if (at === -1) return undefined;
	const open = at + ".default(".length - 1;
	const end = matchBrace(expr, open, "()");
	if (end === -1) return undefined;
	let value = expr.slice(open + 1, end - 1).trim();
	// Basit sabitleri temizle: "x" → x, yeni satır kaçışlarını çöz.
	if (/^["'].*["']$/s.test(value)) {
		value = value.slice(1, -1).replace(/\\n/g, "\n");
	}
	if (value === "true") return "true";
	if (value === "false") return "false";
	if (value.startsWith("[") || value.startsWith("{")) return value;
	if (/^\d+(\.\d+)?$/.test(value)) return value;
	return value;
}

function parseField(name: string, expr: string): FieldDef {
	const required = !/\.optional\(|\.nullable\(/.test(expr);
	const field: FieldDef = { name, label: displayKey(name), type: "json", required };

	const enumMatch = expr.match(/z\.enum\(/);
	if (enumMatch?.index !== undefined) {
		const open = expr.indexOf("(", enumMatch.index + "z.enum".length - 1);
		const end = matchBrace(expr, Math.max(open, 0), "([");
		field.type = "enum";
		field.options = extractQuotedList(
			end === -1 ? expr : expr.slice(open, end),
		);
	} else if (/z\.coerce\.date\(|z\.date\(|z\.string\(\)\.datetime/.test(expr)) {
		field.type = /z\.string\(\)\.datetime/.test(expr) ? "datetime" : "date";
	} else if (/z\.boolean\(/.test(expr)) {
		field.type = "boolean";
	} else if (/z\.coerce\.number\(|z\.number\(|z\.int\(/.test(expr)) {
		field.type = "number";
	} else if (/z\.array\(/.test(expr)) {
		field.type = /z\.string\(|z\.enum\(/.test(expr) ? "string[]" : "json";
	} else if (/z\.string\(/.test(expr)) {
		field.type = MULTILINE_FIELDS.has(name.toLowerCase()) ? "richtext" : "string";
	}
	// z.object / z.record / z.union → json (fallback) olarak kalır.

	const def = extractDefault(expr);
	if (def !== undefined) field.default = def;
	return field;
}

/** `schema: z.object({ ... })` gövdesini alan listesine çevirir. */
function parseSchemaObject(body: string): FieldDef[] {
	const fields: FieldDef[] = [];
	const lines = body.split("\n");
	let currentName: string | null = null;
	let currentExpr: string[] = [];
	let depth = 0;

	const flush = () => {
		if (currentName) fields.push(parseField(currentName, currentExpr.join("\n")));
		currentName = null;
		currentExpr = [];
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*"))
			continue;

		// Yeni alan başlangıcı: parantez derinliği 0'dayken `ad: z...`
		if (depth === 0) {
			const start = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:\s*(.*)$/);
			if (start) {
				flush();
				currentName = start[1]!;
				currentExpr = [start[2]!];
			} else if (currentName) {
				currentExpr.push(line);
			}
		} else if (currentName) {
			currentExpr.push(line);
		}

		for (const ch of line) {
			if (ch === "(" || ch === "{") depth++;
			else if (ch === ")" || ch === "}") depth--;
		}
	}
	flush();
	return fields;
}

/** `src/content.config.ts` kaynağını koleksiyon tanımlarına çevirir. */
export function parseContentConfig(source: string): CollectionDef[] {
	const collections: CollectionDef[] = [];
	const re = /(?:export\s+)?const\s+(\w+)\s*=\s*defineCollection\(\s*\{/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(source))) {
		const key = m[1]!;
		const open = source.indexOf("{", m.index + m[0].length - 2);
		const end = matchBrace(source, open);
		if (end === -1) continue;
		const block = source.slice(open, end);

		const schemaStart = block.search(/schema\s*:\s*z\.object\(\s*\{/);
		let fields: FieldDef[] = [];
		if (schemaStart !== -1) {
			const objOpen = block.indexOf("{", block.indexOf("z.object", schemaStart));
			const objEnd = matchBrace(block, objOpen);
			if (objEnd !== -1) fields = parseSchemaObject(block.slice(objOpen + 1, objEnd - 1));
		}

		const baseRaw = firstStringLiteral(block, "base") ?? `src/content/${key}`;
		const patternRaw = firstStringLiteral(block, "pattern") ?? "**/*.mdx";
		const ext = patternRaw.match(/\.(\w+)$/)?.[1] ?? "mdx";

		collections.push({
			key,
			name: displayKey(key),
			base: baseRaw.replace(/^\.\//, "").replace(/\/$/, ""),
			extension: ext,
			fields,
		});
	}

	// collections nesnesi export edilmese de const tanımları yeterlidir.
	return collections;
}

const SLUG_MAP: Record<string, string> = {
	ı: "i", İ: "i", ğ: "g", Ğ: "g", ş: "s", Ş: "s",
	ç: "c", Ç: "c", ö: "o", Ö: "o", ü: "u", Ü: "u", â: "a", î: "i", û: "u",
};

/** Başlığı dosya adına çevirir: "Merhaba Dünya!" → "merhaba-dunya". */
export function slugify(title: string): string {
	return title
		.split("")
		.map((ch) => SLUG_MAP[ch] ?? ch)
		.join("")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}
