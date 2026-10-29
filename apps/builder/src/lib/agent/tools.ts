// Ajan araçları — depo dosyaları ve içerik koleksiyonları (ADR 0008).
// Her yazma gerçek bir Git commit'idir; önceki hâl `agent_changes`e yazılır.

import {
	CONTENT_CONFIG_PATH,
	parseContentConfig,
	type CollectionDef,
	type FieldType,
} from "@wuppycms/content-schema";
import { commitFiles, getFile, getRepo, listTree } from "../git";
import { BackendError } from "../git/backend";
import type { SqlDatabase } from "../platform";
import { displayToRaw, parseDoc, serializeDoc } from "../admin/frontmatter";
import { buildNewEntryContent, toEntrySummary } from "../content/entry";
import { newId, recordChange } from "./store";
import type { SelectionContext, ToolSpec } from "./protocol";

export interface ToolContext {
	token: string;
	fullName: string;
	branch: string;
	userId: string;
	db: SqlDatabase;
	siteUrl: string | null;
	document?: { collection: string; path: string } | null;
	pagePath?: string | null;
	selections?: SelectionContext[];
}

export interface ChangeInfo {
	changeId: string;
	kind: string;
	path: string;
	label: string;
}

export interface ToolHooks {
	onContentChange?(info: ChangeInfo): void;
}

export interface AgentTool {
	spec: ToolSpec;
	execute(args: Record<string, unknown>): Promise<unknown>;
}

// --- yol güvenliği ---------------------------------------------------------------

const ALLOW_PREFIXES = ["src/", "public/", "scripts/", ".wuppycms/"];
const ALLOW_FILES = new Set([
	"astro.config.mjs",
	"astro.config.ts",
	"package.json",
	"tsconfig.json",
	"README.md",
	"AGENTS.md",
	"DESIGN_SYSTEM.md",
]);
const DENY_FRAGMENTS = [".env", "node_modules", ".git/", "dist/", ".wrangler", "pnpm-lock.yaml", "package-lock.json"];
const TEXT_EXTENSIONS = new Set([
	".astro", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
	".css", ".md", ".mdx", ".html", ".svg", ".txt", ".yml", ".yaml",
]);

function safePath(input: string): string {
	const rel = input.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
	if (!rel || rel.startsWith("/") || rel.split("/").includes("..")) {
		throw new Error(`Yol depo köküne göre göreli olmalı ve ".." içermemeli ("${input}").`);
	}
	if (DENY_FRAGMENTS.some((part) => rel.includes(part))) {
		throw new Error(`Bu yol ajana kapalı: "${rel}"`);
	}
	const allowed =
		ALLOW_FILES.has(rel) ||
		ALLOW_PREFIXES.some((prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix));
	if (!allowed) {
		throw new Error(`"${rel}" izinli liste dışında (${ALLOW_PREFIXES.join(", ")} + ${[...ALLOW_FILES].join(", ")}).`);
	}
	return rel;
}

function str(args: Record<string, unknown>, key: string): string {
	const value = args[key];
	if (typeof value !== "string" || !value.trim()) throw new Error(`"${key}" (metin) gerekli`);
	return value.trim();
}
function optStr(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function optNum(args: Record<string, unknown>, key: string, fallback: number): number {
	const value = args[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// --- depo yardımcıları -----------------------------------------------------------

async function fileContent(ctx: ToolContext, path: string): Promise<string | null> {
	try {
		return (await getFile(ctx.token, ctx.fullName, path, ctx.branch)).content;
	} catch (error) {
		if (error instanceof BackendError && error.status === 404) return null;
		throw error;
	}
}

async function projectTree(ctx: ToolContext): Promise<Awaited<ReturnType<typeof listTree>>> {
	return listTree(ctx.token, ctx.fullName, ctx.branch, true);
}

function isTextFile(path: string): boolean {
	const dot = path.lastIndexOf(".");
	return dot >= 0 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

async function writeAndRecord(
	ctx: ToolContext,
	hooks: ToolHooks,
	input: { path: string; content: string; message: string; kind: string; label: string },
): Promise<{ path: string; changeId?: string; unchanged?: boolean; commit?: string }> {
	const before = await fileContent(ctx, input.path);
	if (before === input.content) {
		return { path: input.path, unchanged: true };
	}
	const result = await commitFiles(
		ctx.token,
		ctx.fullName,
		ctx.branch,
		[{ path: input.path, content: input.content }],
		input.message,
	);
	const changeId = newId("chg");
	await recordChange(ctx.db, {
		id: changeId,
		userId: ctx.userId,
		repoFullName: ctx.fullName,
		kind: input.kind,
		path: input.path,
		label: input.label,
		before,
		after: input.content,
	});
	hooks.onContentChange?.({ changeId, kind: input.kind, path: input.path, label: input.label });
	return { path: input.path, changeId, commit: result?.sha };
}

// --- içerik yardımcıları ---------------------------------------------------------

async function loadCollections(
	ctx: ToolContext,
): Promise<{ collections: CollectionDef[]; configFound: boolean }> {
	const source = await fileContent(ctx, CONTENT_CONFIG_PATH);
	if (!source) return { collections: [], configFound: false };
	return { collections: parseContentConfig(source), configFound: true };
}

function findCollection(collections: CollectionDef[], key: string): CollectionDef {
	const collection = collections.find((entry) => entry.key === key);
	if (!collection) {
		throw new Error(`Koleksiyon bulunamadı: ${key}. Mevcut: ${collections.map((c) => c.key).join(", ") || "yok"}`);
	}
	return collection;
}

function collectionForPath(collections: CollectionDef[], path: string): CollectionDef | undefined {
	return collections.find((collection) => path.startsWith(`${collection.base}/`));
}

function entryPath(collection: CollectionDef, slug: string): string {
	const clean = slug.replace(/^\/+|\/+$/g, "").replace(/\.[^.]+$/, "");
	return `${collection.base}/${clean}.${collection.extension}`;
}

function resolveEntryPath(
	collections: CollectionDef[],
	args: Record<string, unknown>,
): { path: string; collection: CollectionDef } {
	const direct = optStr(args, "path");
	if (direct) {
		const path = safePath(direct);
		const collection = collectionForPath(collections, path);
		if (!collection) throw new Error(`"${path}" bir koleksiyon klasöründe değil.`);
		return { path, collection };
	}
	const collection = findCollection(collections, str(args, "collection"));
	const slug = optStr(args, "id") ?? optStr(args, "slug");
	if (!slug) throw new Error('"path" ya da "collection" + "id"/"slug" gerekli.');
	return { path: entryPath(collection, slug), collection };
}

function fieldType(collection: CollectionDef, key: string): FieldType | undefined {
	return collection.fields.find((field) => field.name === key)?.type;
}

/** Ajanın gönderdiği JSON değerini YAML ham değerine çevirir. */
function toRawValue(value: unknown, type?: FieldType): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) {
		const items = value.map((item) => JSON.stringify(String(item)));
		return `[${items.join(", ")}]`;
	}
	if (typeof value === "object") return JSON.stringify(value);
	return displayToRaw(String(value), type ?? "string");
}

// --- araç listesi ----------------------------------------------------------------

export function buildTools(ctx: ToolContext, hooks: ToolHooks = {}): AgentTool[] {
	const tools: AgentTool[] = [];

	tools.push({
		spec: {
			name: "get_site_info",
			description:
				"Repo adı, dal, site URL'i ve içerik koleksiyonları (alanlarıyla). İlk çağrı olarak kullan.",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			const repo = await getRepo(ctx.token, ctx.fullName);
			const { collections, configFound } = await loadCollections(ctx);
			return {
				repo: ctx.fullName,
				branch: ctx.branch,
				defaultBranch: repo.defaultBranch,
				siteUrl: ctx.siteUrl,
				contentConfigFound: configFound,
				currentDocument: ctx.document ?? null,
				previewPage: ctx.pagePath ?? null,
				collections: collections.map((collection) => ({
					key: collection.key,
					name: collection.name,
					base: collection.base,
					extension: collection.extension,
					fields: collection.fields.map((field) => ({
						name: field.name,
						type: field.type,
						required: field.required,
						...(field.options ? { options: field.options } : {}),
					})),
				})),
			};
		},
	});

	tools.push({
		spec: {
			name: "read_file",
			description:
				"Depodan bir kaynak dosya okur. Büyük dosyalar satır sayfalıdır: offset (1 tabanlı) ve limit ver; sonuç totalLines/from/to/truncated döndürür.",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Depo köküne göreli yol (ör. src/pages/index.astro)" },
					offset: { type: "number", description: "İlk satır (1 tabanlı)" },
					limit: { type: "number", description: "En fazla satır (varsayılan 400, üst sınır 400)" },
				},
				required: ["path"],
			},
		},
		async execute(args) {
			const path = safePath(str(args, "path"));
			const raw = await fileContent(ctx, path);
			if (raw === null) throw new Error(`Dosya yok: "${path}"`);
			const lines = raw.split("\n");
			const totalLines = lines.length;
			const maxLines = Math.min(Math.max(1, optNum(args, "limit", 400)), 400);
			const from = Math.max(1, Math.trunc(optNum(args, "offset", 1)));
			const to = Math.min(totalLines, from + maxLines - 1);
			return {
				path,
				content: lines.slice(from - 1, to).join("\n"),
				bytes: new TextEncoder().encode(raw).length,
				totalLines,
				from,
				to,
				truncated: from > 1 || to < totalLines,
			};
		},
	});

	tools.push({
		spec: {
			name: "write_file",
			description:
				"Bir kaynak dosyayı tam içerikle oluşturur/üzerine yazar. Değişiklik tek commit olur.",
			inputSchema: {
				type: "object",
				properties: { path: { type: "string" }, content: { type: "string" } },
				required: ["path", "content"],
			},
		},
		async execute(args) {
			const path = safePath(str(args, "path"));
			const content = typeof args.content === "string" ? args.content : str(args, "content");
			return writeAndRecord(ctx, hooks, {
				path,
				content,
				message: `AI: ${path} yazıldı (via WuppyCMS)`,
				kind: "write",
				label: path,
			});
		},
	});

	tools.push({
		spec: {
			name: "edit_file",
			description:
				"Bir dosyada exact oldString'i newString ile değiştirir. oldString tek geçmelidir (replaceAll ile hepsi). Önce read_file kullan.",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string" },
					oldString: { type: "string" },
					newString: { type: "string" },
					replaceAll: { type: "boolean" },
				},
				required: ["path", "oldString", "newString"],
			},
		},
		async execute(args) {
			const path = safePath(str(args, "path"));
			const oldString = str(args, "oldString");
			const newString = typeof args.newString === "string" ? args.newString : "";
			const full = await fileContent(ctx, path);
			if (full === null) throw new Error(`Dosya yok: "${path}"`);
			const occurrences = full.split(oldString).length - 1;
			if (occurrences === 0) throw new Error(`oldString "${path}" içinde bulunamadı.`);
			if (occurrences > 1 && args.replaceAll !== true) {
				throw new Error(`oldString "${path}" içinde ${occurrences} kez geçiyor; bağlam ekleyin veya replaceAll kullanın.`);
			}
			const updated =
				args.replaceAll === true
					? full.split(oldString).join(newString)
					: full.replace(oldString, newString);
			const beforeLines = full.split("\n").length;
			const afterLines = updated.split("\n").length;
			if (beforeLines >= 120 && afterLines < beforeLines * 0.7) {
				throw new Error(
					`Bu düzenleme dosyanın %${Math.round((1 - afterLines / beforeLines) * 100)}'ini siliyor (${beforeLines} → ${afterLines} satır). Daha küçük oldString/newString kullanın veya write_file ile tam içeriği yazın.`,
				);
			}
			const result = await writeAndRecord(ctx, hooks, {
				path,
				content: updated,
				message: `AI: ${path} düzenlendi (via WuppyCMS)`,
				kind: "edit",
				label: path,
			});
			return { ...result, replacements: args.replaceAll === true ? occurrences : 1 };
		},
	});

	tools.push({
		spec: {
			name: "list_files",
			description: 'Depo dosya ağacı (dizinler "/" ile biter).',
			inputSchema: {
				type: "object",
				properties: {
					dir: { type: "string", description: "Başlangıç klasörü (varsayılan kök)" },
					depth: { type: "number", description: "Alt klasör derinliği (varsayılan 3)" },
				},
			},
		},
		async execute(args) {
			const dir = (optStr(args, "dir") ?? ".").replace(/^\.\/$/, "").replace(/^\/+|\/+$/g, "");
			const depth = Math.min(Math.max(1, optNum(args, "depth", 3)), 6);
			const tree = await projectTree(ctx);
			const prefix = dir && dir !== "." ? `${dir}/` : "";
			const allowed = tree.entries.filter((entry) => {
				if (entry.type === "tree") return false;
				if (!safeTreePath(entry.path)) return false;
				if (!entry.path.startsWith(prefix)) return false;
				const rest = entry.path.slice(prefix.length);
				return rest.split("/").length <= depth;
			});
			return {
				entries: allowed.slice(0, 800).map((entry) => ({ path: entry.path, bytes: entry.size ?? 0 })),
				truncated: tree.truncated || allowed.length > 800,
			};
		},
	});

	tools.push({
		spec: {
			name: "grep",
			description:
				"Depodaki metin dosyalarında regex arar; {path, line, text} döndürür. pathContains ile daraltın.",
			inputSchema: {
				type: "object",
				properties: {
					pattern: { type: "string" },
					dir: { type: "string" },
					pathContains: { type: "string" },
				},
				required: ["pattern"],
			},
		},
		async execute(args) {
			const pattern = str(args, "pattern");
			let regex: RegExp;
			try {
				regex = new RegExp(pattern, "i");
			} catch (error) {
				throw new Error(`Geçersiz düzenli ifade: ${(error as Error).message}`);
			}
			const dir = (optStr(args, "dir") ?? "").replace(/^\/+|\/+$/g, "");
			const pathContains = optStr(args, "pathContains");
			const tree = await projectTree(ctx);
			const candidates = tree.entries
				.filter(
					(entry) =>
						entry.type === "blob" &&
						isTextFile(entry.path) &&
						safeTreePath(entry.path) &&
						(!dir || entry.path.startsWith(`${dir}/`)) &&
						(!pathContains || entry.path.includes(pathContains)),
				)
				.slice(0, 40);
			const matches: Array<{ path: string; line: number; text: string }> = [];
			for (let index = 0; index < candidates.length && matches.length < 200; index += 8) {
				const chunk = candidates.slice(index, index + 8);
				const contents = await Promise.allSettled(
					chunk.map(async (entry) => ({ entry, raw: await fileContent(ctx, entry.path) })),
				);
				for (const result of contents) {
					if (result.status !== "fulfilled" || result.value.raw === null) continue;
					const lines = result.value.raw.split("\n");
					for (let line = 0; line < lines.length; line += 1) {
						if (matches.length >= 200) break;
						if (regex.test(lines[line] ?? "")) {
							matches.push({
								path: result.value.entry.path,
								line: line + 1,
								text: (lines[line] ?? "").trim().slice(0, 240),
							});
						}
					}
				}
			}
			return {
				matches,
				truncated: matches.length >= 200 || candidates.length >= 40,
				scanned: candidates.length,
			};
		},
	});

	tools.push({
		spec: {
			name: "load_agent_instructions",
			description: "Depodaki AGENTS.md / README.md / DESIGN_SYSTEM.md yönergelerini okur.",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			const parts: string[] = [];
			for (const path of ["AGENTS.md", "README.md", "DESIGN_SYSTEM.md"]) {
				const raw = await fileContent(ctx, path);
				if (raw) parts.push(`### ${path}\n${raw.slice(0, 6_000)}`);
			}
			return { instructions: parts.join("\n\n") || "Depoda AGENTS.md/README.md yok." };
		},
	});

	// --- içerik -------------------------------------------------------------------

	tools.push({
		spec: {
			name: "content_list",
			description:
				"Bir koleksiyonun kayıtlarını listeler (path, slug, title, date, status, draft).",
			inputSchema: {
				type: "object",
				properties: { collection: { type: "string" }, limit: { type: "number" } },
				required: ["collection"],
			},
		},
		async execute(args) {
			const { collections, configFound } = await loadCollections(ctx);
			if (!configFound) throw new Error(`${CONTENT_CONFIG_PATH} bulunamadı.`);
			const collection = findCollection(collections, str(args, "collection"));
			const tree = await projectTree(ctx);
			const files = tree.entries
				.filter(
					(entry) =>
						entry.type === "blob" &&
						entry.path.startsWith(`${collection.base}/`) &&
						entry.path.endsWith(`.${collection.extension}`),
				)
				.slice(0, Math.min(Math.max(1, optNum(args, "limit", 40)), 80));
			const rows = [];
			for (const entry of files) {
				const raw = await fileContent(ctx, entry.path);
				if (raw !== null) rows.push(toEntrySummary(entry.path, collection.extension, raw));
			}
			return { collection: collection.key, items: rows, truncated: files.length >= 80 };
		},
	});

	tools.push({
		spec: {
			name: "content_get",
			description: "Bir kaydın tam ham içeriğini (frontmatter + gövde) okur.",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Depo yolu (ör. src/content/blog/x.mdx)" },
					collection: { type: "string" },
					id: { type: "string", description: "slug" },
				},
				required: [],
			},
		},
		async execute(args) {
			const { collections } = await loadCollections(ctx);
			const resolved = resolveEntryPath(collections, args);
			const raw = await fileContent(ctx, resolved.path);
			if (raw === null) throw new Error(`Kayıt yok: "${resolved.path}"`);
			const parsed = parseDoc(raw);
			return {
				path: resolved.path,
				collection: resolved.collection.key,
				frontmatter: Object.fromEntries(parsed.values),
				order: parsed.order,
				body: parsed.body.slice(0, 20_000),
				truncated: parsed.body.length > 20_000,
			};
		},
	});

	tools.push({
		spec: {
			name: "content_update",
			description:
				"Bir kaydın frontmatter alanlarını ve/veya gövdesini günceller. `data` alan değerleridir; `body` verilirse gövde değişir, `appendBody` ekler. Tek commit.",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string" },
					collection: { type: "string" },
					id: { type: "string" },
					data: { type: "object" },
					body: { type: "string" },
					appendBody: { type: "string" },
				},
				required: [],
			},
		},
		async execute(args) {
			const { collections, configFound } = await loadCollections(ctx);
			if (!configFound) throw new Error(`${CONTENT_CONFIG_PATH} bulunamadı.`);
			const resolved = resolveEntryPath(collections, args);
			const raw = await fileContent(ctx, resolved.path);
			if (raw === null) throw new Error(`Kayıt yok: "${resolved.path}"`);
			const parsed = parseDoc(raw);
			const order = [...parsed.order];
			const values = new Map(parsed.values);
			const data = (args.data ?? {}) as Record<string, unknown>;
			for (const [key, value] of Object.entries(data)) {
				if (!order.includes(key)) order.push(key);
				values.set(key, toRawValue(value, fieldType(resolved.collection, key)));
			}
			let body = parsed.body;
			if (typeof args.body === "string") body = args.body;
			if (typeof args.appendBody === "string" && args.appendBody.trim()) {
				body = `${body.trimEnd()}\n\n${args.appendBody.trim()}\n`;
			}
			const title = values.get("title")?.replace(/^["']|["']$/g, "") ?? resolved.path;
			const result = await writeAndRecord(ctx, hooks, {
				path: resolved.path,
				content: serializeDoc(order, values, body),
				message: `AI: ${resolved.collection.key} · ${title} güncellendi (via WuppyCMS)`,
				kind: "content_update",
				label: `${resolved.collection.key} · ${title}`,
			});
			return { ...result, collection: resolved.collection.key };
		},
	});

	tools.push({
		spec: {
			name: "content_create",
			description:
				"Koleksiyonda yeni bir kayıt oluşturur. `data.title` zorunlu; diğer alanlar şema varsayılanlarıyla dolar.",
			inputSchema: {
				type: "object",
				properties: {
					collection: { type: "string" },
					slug: { type: "string" },
					data: { type: "object" },
					body: { type: "string" },
				},
				required: ["collection", "data"],
			},
		},
		async execute(args) {
			const { collections, configFound } = await loadCollections(ctx);
			if (!configFound) throw new Error(`${CONTENT_CONFIG_PATH} bulunamadı.`);
			const collection = findCollection(collections, str(args, "collection"));
			const data = (args.data ?? {}) as Record<string, unknown>;
			const title = typeof data.title === "string" ? data.title : optStr(args, "title") ?? "Yeni kayıt";
			const slug = optStr(args, "slug") ?? title;
			const path = entryPath(collection, slugify(slug));
			if (await fileContent(ctx, path)) throw new Error(`${path} zaten var.`);
			const base = parseDoc(buildNewEntryContent(collection, title));
			const order = [...base.order];
			const values = new Map(base.values);
			for (const [key, value] of Object.entries(data)) {
				if (!order.includes(key)) order.push(key);
				values.set(key, toRawValue(value, fieldType(collection, key)));
			}
			const body = typeof args.body === "string" ? args.body : base.body;
			const result = await writeAndRecord(ctx, hooks, {
				path,
				content: serializeDoc(order, values, body || "\n"),
				message: `AI: ${collection.key} · ${title} oluşturuldu (via WuppyCMS)`,
				kind: "content_create",
				label: `${collection.key} · ${title}`,
			});
			return { ...result, collection: collection.key };
		},
	});

	tools.push({
		spec: {
			name: "content_publish",
			description: 'Bir kaydı yayına hazırlar (frontmatter status: "ready"). Tek commit.',
			inputSchema: {
				type: "object",
				properties: { path: { type: "string" }, collection: { type: "string" }, id: { type: "string" } },
				required: [],
			},
		},
		async execute(args) {
			return setStatus(ctx, hooks, args, "ready");
		},
	});

	tools.push({
		spec: {
			name: "content_unpublish",
			description: 'Bir kaydı taslağa çeker (frontmatter status: "draft"). Tek commit.',
			inputSchema: {
				type: "object",
				properties: { path: { type: "string" }, collection: { type: "string" }, id: { type: "string" } },
				required: [],
			},
		},
		async execute(args) {
			return setStatus(ctx, hooks, args, "draft");
		},
	});

	tools.push({
		spec: {
			name: "undo_last_change",
			description:
				"Bu ajanın yaptığı en son yazmayı geri commit'ler (önceki içerik geri yüklenir; yeni dosya silinir).",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			const { latestChange, markChangeReverted, removeChangeIdFromMessages } = await import("./store");
			const change = await latestChange(ctx.db, ctx.userId, ctx.fullName);
			if (!change || !change.path) throw new Error("Geri alınacak bir değişiklik yok.");
			if (change.before === null) {
				await commitFiles(
					ctx.token,
					ctx.fullName,
					ctx.branch,
					[{ path: change.path, content: "", delete: true }],
					`AI: ${change.path} geri alındı (via WuppyCMS)`,
				);
			} else {
				await commitFiles(
					ctx.token,
					ctx.fullName,
					ctx.branch,
					[{ path: change.path, content: change.before }],
					`AI: ${change.path} geri alındı (via WuppyCMS)`,
				);
			}
			await markChangeReverted(ctx.db, change.id);
			await removeChangeIdFromMessages(ctx.db, change.id);
			return { reverted: true, path: change.path, changeId: change.id };
		},
	});

	tools.push({
		spec: {
			name: "get_page_context",
			description:
				"Kullanıcının baktığı bağlam: açık doküman, önizleme sayfası ve seçili elementler. Hedefi belirlerken kullan.",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			return {
				document: ctx.document ?? null,
				pagePath: ctx.pagePath ?? null,
				siteUrl: ctx.siteUrl,
				selections: ctx.selections ?? [],
			};
		},
	});

	return tools;
}

async function setStatus(
	ctx: ToolContext,
	hooks: ToolHooks,
	args: Record<string, unknown>,
	status: "ready" | "draft",
) {
	const { collections, configFound } = await loadCollections(ctx);
	if (!configFound) throw new Error(`${CONTENT_CONFIG_PATH} bulunamadı.`);
	const resolved = resolveEntryPath(collections, args);
	const raw = await fileContent(ctx, resolved.path);
	if (raw === null) throw new Error(`Kayıt yok: "${resolved.path}"`);
	const parsed = parseDoc(raw);
	const order = [...parsed.order];
	const values = new Map(parsed.values);
	if (!order.includes("status")) order.push("status");
	values.set("status", status);
	const title = values.get("title")?.replace(/^["']|["']$/g, "") ?? resolved.path;
	const result = await writeAndRecord(ctx, hooks, {
		path: resolved.path,
		content: serializeDoc(order, values, parsed.body),
		message:
			status === "ready"
				? `AI: ${resolved.collection.key} · ${title} yayına hazır (via WuppyCMS)`
				: `AI: ${resolved.collection.key} · ${title} taslağa alındı (via WuppyCMS)`,
		kind: status === "ready" ? "publish" : "unpublish",
		label: `${resolved.collection.key} · ${title}`,
	});
	return { ...result, status, live: status === "ready" };
}

function safeTreePath(path: string): boolean {
	if (DENY_FRAGMENTS.some((part) => path.includes(part))) return false;
	return ALLOW_PREFIXES.some((prefix) => path.startsWith(prefix)) || ALLOW_FILES.has(path);
}

function slugify(value: string): string {
	const map: Record<string, string> = {
		ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
		Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
	};
	return value
		.split("")
		.map((char) => map[char] ?? char)
		.join("")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80) || `kayit-${Date.now()}`;
}

