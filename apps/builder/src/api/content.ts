// İçerik API'si — CMS'in veri modeli: koleksiyon şeması, girdi listesi ve
// yeni doküman oluşturma. İçerik repoda yaşar; burada yalnızca okunur/üretilir.

import { Hono } from "hono";
import { CONTENT_CONFIG_PATH, parseContentConfig } from "@wuppycms/content-schema";
import type { CollectionDef } from "@wuppycms/content-schema";
import { getFile, getRepo, BackendError, listCommits, listTree } from "../lib/git";
import { buildNewEntryContent, toEntrySummary } from "../lib/content/entry";
import { commitFiles } from "../lib/git";
import type { AppEnv } from "./types";
import { requireQuery, requireUser, resolveGitToken, unauthorized } from "./helpers";
import { body, contentCollectionSchema, contentEntrySchema } from "./schemas";

export const content = new Hono<{ Bindings: AppEnv }>();

const MAX_ENTRIES = 80;

/** Bir repo için koleksiyon tanımlarını (content.config.ts) çözümler. */
async function loadCollections(
	token: string,
	fullName: string,
	ref?: string,
): Promise<{ ref: string; collections: CollectionDef[]; configFound: boolean }> {
	const repo = ref ? null : await getRepo(token, fullName);
	const branch = ref ?? repo!.defaultBranch;
	let configSource: string;
	try {
		configSource = (await getFile(token, fullName, CONTENT_CONFIG_PATH, branch)).content;
	} catch (error) {
		if (error instanceof BackendError && error.status === 404) {
			return { ref: branch, collections: [], configFound: false };
		}
		throw error;
	}
	return { ref: branch, collections: parseContentConfig(configSource), configFound: true };
}

function findCollection(
	collections: CollectionDef[],
	key: string,
): CollectionDef {
	const collection = collections.find((c) => c.key === key);
	if (!collection) {
		throw new BackendError(404, `Koleksiyon bulunamadı: ${key}`);
	}
	return collection;
}

// GET /api/content/schema?full_name=owner/repo[&ref=]
content.get("/schema", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const { ref, collections, configFound } = await loadCollections(
		token,
		fullName,
		c.req.query("ref"),
	);
	return c.json({ path: CONTENT_CONFIG_PATH, ref, collections, configFound });
});

// GET /api/content/entries?full_name=…&collection=blog[&ref=]
content.get("/entries", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const { ref, collections, configFound } = await loadCollections(
		token,
		fullName,
		c.req.query("ref"),
	);
	if (!configFound) {
		return c.json({
			error: "no_config",
			message: `${CONTENT_CONFIG_PATH} bulunamadı — bu bir WuppyCMS site şablonu olmayabilir.`,
		}, 422);
	}
	const collection = findCollection(collections, requireQuery(c, "collection"));

	const tree = await listTree(token, fullName, ref, true);
	const files = tree.entries
		.filter(
			(e) =>
				e.type === "blob" &&
				e.path.startsWith(`${collection.base}/`) &&
				e.path.endsWith(`.${collection.extension}`),
		)
		.slice(0, MAX_ENTRIES);

	const settled = await Promise.allSettled(
		files.map(async (file) => {
			const { content: raw } = await getFile(token, fullName, file.path, ref);
			return toEntrySummary(file.path, collection.extension, raw);
		}),
	);
	const entries = settled
		.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof toEntrySummary>>> => r.status === "fulfilled")
		.map((r) => r.value);

	// Dosya bazlı son commit (GitCMS'in "Change note / Updated by" kolonları).
	// Küçük koleksiyonlarda zenginleştir; büyüklerinde atla (GitHub istek limiti).
	if (entries.length <= 40) {
		const commits = await Promise.allSettled(
			entries.map((entry) => listCommits(token, fullName, { ref, path: entry.path, perPage: 1 })),
		);
		entries.forEach((entry, index) => {
			const result = commits[index];
			const last = result?.status === "fulfilled" ? result.value[0] : undefined;
			if (last) {
				entry.lastCommit = {
					sha: last.sha.slice(0, 7),
					message: last.message.split("\n")[0] ?? "",
					author: last.authorName,
					date: last.date,
				};
			}
		});
	}

	entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

	return c.json({
		ref,
		collection: { key: collection.key, name: collection.name, base: collection.base },
		truncated: tree.truncated || files.length >= MAX_ENTRIES,
		entries,
	});
});

// POST /api/content/entry — { full_name, collection, title, slug? }
// Şema varsayılanlarından yeni bir doküman üretir ve commit eder.
content.post("/entry", body(contentEntrySchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);

	const payload = c.req.valid("json");
	const fullName = payload.full_name;
	const collectionKey = payload.collection;
	const title = payload.title;

	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);

	const { ref, collections, configFound } = await loadCollections(token, fullName);
	if (!configFound) {
		return c.json({ error: "no_config", message: `${CONTENT_CONFIG_PATH} bulunamadı.` }, 422);
	}
	const collection = findCollection(collections, collectionKey);

	const { slugify } = await import("@wuppycms/content-schema");
	const slug = slugify(payload.slug ?? title) || `yeni-${Date.now()}`;
	const path = `${collection.base}/${slug}.${collection.extension}`;

	// Çakışma kontrolü — aynı adda doküman varsa üste yazmayalım.
	try {
		await getFile(token, fullName, path, ref);
		return c.json(
			{ error: "exists", message: `${path} zaten var. Farklı bir başlık/seçki deneyin.` },
			409,
		);
	} catch (error) {
		if (!(error instanceof BackendError) || error.status !== 404) throw error;
	}

	const result = await commitFiles(
		token,
		fullName,
		ref,
		[{ path, content: buildNewEntryContent(collection, title) }],
		`Create new ${collection.name.toLowerCase()} entry (via WuppyCMS)`,
	);
	return c.json({ ...result, path, collection: collectionKey }, 201);
});

// POST /api/content/collection — { full_name, key, base?, pattern?, fields? }
// src/content.config.ts'e yeni bir defineCollection bloğu ekler ve
// `export const collections` listesini günceller (Add Collection sihirbazı).
content.post("/collection", body(contentCollectionSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const fullName = payload.full_name;
	const key = payload.key;

	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);

	const repo = await getRepo(token, fullName);
	const ref = repo.defaultBranch;

	let configSource: string;
	try {
		const file = await getFile(token, fullName, CONTENT_CONFIG_PATH, ref);
		configSource = file.content;
	} catch {
		return c.json({ error: "no_config", message: `${CONTENT_CONFIG_PATH} bulunamadı.` }, 422);
	}
	if (parseContentConfig(configSource).some((collection) => collection.key === key)) {
		return c.json({ error: "exists", message: `“${key}” koleksiyonu zaten var.` }, 409);
	}

	const base = (payload.base ?? `src/content/${key}`).replace(/^\.\//, "").replace(/\/+$/, "");
	const pattern = payload.pattern ?? "**/*.mdx";
	const fields = payload.fields ?? ["description", "date"];
	const schemaLines = [
		"\t\ttitle: z.string(),",
		...fields.map((field) =>
			field === "date"
				? "\t\tdate: z.date().optional(),"
				: field === "description"
					? "\t\tdescription: z.string().optional(),"
					: `\t\t${field}: z.string().optional(),`,
		),
	];
	const block = `\nconst ${key} = defineCollection({\n\tbase: "${base}",\n\tpattern: "${pattern}",\n\tschema: z.object({\n${schemaLines.join("\n")}\n\t}),\n});\n`;

	let next = configSource.replace(/\s*$/, "\n") + block;
	const exportRe = /export\s+const\s+collections\s*=\s*\{([^}]*)\}\s*;?/;
	const match = next.match(exportRe);
	if (!match) {
		return c.json(
			{ error: "no_exports", message: "content.config.ts içinde `export const collections = {...}` bulunamadı." },
			422,
		);
	}
	const keys = match[1]!
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	keys.push(key);
	next = next.replace(exportRe, `export const collections = { ${keys.join(", ")} };`);

	await commitFiles(
		token,
		fullName,
		ref,
		[{ path: CONTENT_CONFIG_PATH, content: next }],
		`cms: ${key} koleksiyonu eklendi (via WuppyCMS)`,
	);
	return c.json({ ok: true, key, base, pattern }, 201);
});
