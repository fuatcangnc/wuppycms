// R2 medya kitaplığı — platform binding'i üzerinden çalışır (kullanıcı
// kimliği/entegrasyonu gerekmez). WuppyCMS worker'ının bağlı kovasına doğrudan
// yazılır; istemci yalnız bizim oturumumuzla konuşur. Bağlantı yoksa (ör.
// kovaya henüz bağlı değil) düzgün hata döner.

import { Hono } from "hono";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveGitToken, type ApiContext } from "./helpers";
import type { BlobStore } from "../lib/platform";
import { body, mediaAltSchema, mediaMoveSchema } from "./schemas";
import { commitFiles, getBlobBase64, getFile, getRepo, listTree } from "../lib/git";

export const media = new Hono<{ Bindings: AppEnv }>();

function loginRequired(c: { json: (b: unknown, s: number) => Response }): Response {
	return c.json({ error: "unauthenticated", message: "Oturum gerekli." }, 401);
}

type R2Object = { key: string; size: number; uploaded: string };

/** R2 kovası (ADR 0006 dikişi) — bağlı değilse null. */
function bucket(c: ApiContext): BlobStore | null {
	return platform(c).blobs ?? null;
}

// GET /api/media/r2?prefix=assets/&cursor=… — liste (önek + sayfa imi).
media.get("/r2", async (c) => {
	if (!(await requireUser(c))) return loginRequired(c);
	const store = bucket(c);
	if (!store) {
		return c.json({ error: "not_configured", message: "Bu ortamda R2 medya kovası bağlı değil.", objects: [], truncated: false }, 503);
	}
	const prefix = c.req.query("prefix") ?? "";
	const cursor = c.req.query("cursor") || undefined;
	const listed = await store.list({ prefix, limit: 200, cursor });
	const objects: R2Object[] = listed.objects
		.filter((o) => !o.key.endsWith("/"))
		.map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded.toISOString() }));
	return c.json({
		objects,
		truncated: listed.truncated,
		cursor: listed.truncated ? (listed.cursor ?? null) : null,
	});
});

// POST /api/media/r2 — body: { key, content(base64), contentType? }
media.post("/r2", async (c) => {
	if (!(await requireUser(c))) return loginRequired(c);
	const store = bucket(c);
	if (!store) {
		return c.json({ error: "not_configured", message: "Bu ortamda R2 medya kovası bağlı değil." }, 503);
	}
	const body = await c.req
		.json<{ key?: string; content?: string; contentType?: string }>()
		.catch(() => ({}) as Record<string, never>);
	const key = (body.key ?? "").replace(/^\/+/, "");
	if (!key || key.includes("..")) {
		return c.json({ error: "invalid", message: "Geçersiz nesne anahtarı." }, 400);
	}
	if (body.content == null) return c.json({ error: "invalid", message: "İçerik boş." }, 400);

	const binary = atob(body.content);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

	await store.put(key, bytes, {
		httpMetadata: { contentType: body.contentType ?? "application/octet-stream" },
	});
	return c.json({ key }, 201);
});

// GET /api/media/r2/raw?key=… — public base URL yoksa önizleme akışı.
media.get("/r2/raw", async (c) => {
	const store = bucket(c);
	const key = (c.req.query("key") ?? "").replace(/^\/+/, "");
	if (!store || !key || key.includes("..")) return c.json({ error: "invalid" }, 400);
	const object = await store.get(key);
	if (!object) return c.json({ error: "not_found" }, 404);
	return new Response(object.body as ReadableStream, {
		headers: {
			"content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
			"cache-control": "public, max-age=300",
		},
	});
});
media.delete("/r2", async (c) => {
	if (!(await requireUser(c))) return loginRequired(c);
	const store = bucket(c);
	if (!store) return c.json({ error: "not_configured", message: "R2 kovası bağlı değil." }, 503);
	const key = (c.req.query("key") ?? "").replace(/^\/+/, "");
	if (!key || key.includes("..")) return c.json({ error: "invalid", message: "Geçersiz anahtar." }, 400);
	await store.delete(key);
	return c.json({ ok: true });
});

// --- alt metin / caption — REPO MANİFESTİ (P4 / ADR 0006) ----------------------
// Dosyalar repoda/kovalarda kalır; alt metin ve başlık `.wuppycms/media.json`
// içinde yaşar — OSS taşınabilirlik (D1'deki media_meta tablosu artık
// kullanılmaz; geçmiş için durur). Her güncelleme normal bir commit'tir.

const MEDIA_META_PATH = ".wuppycms/media.json";
type MediaMetaItem = {
	alt?: string;
	caption?: string;
	/** Odak noktası (yüzde 0-100) — kırpma yerine kompozisyon ipucu. */
	focal?: { x: number; y: number };
	/** Gösterim genişliği (yüzde) — seçici HTML img ile ekler. */
	width?: number;
};
type MediaMetaFile = { version: 1; items: Record<string, MediaMetaItem> };

/** Manifesti okur; yok/bozuksa boş döner (ilk yazımda oluşur). */
async function readMediaMeta(token: string, fullName: string, branch: string): Promise<MediaMetaFile> {
	try {
		const file = await getFile(token, fullName, MEDIA_META_PATH, branch);
		const parsed = JSON.parse(file.content) as MediaMetaFile;
		if (parsed && typeof parsed === "object" && parsed.items && typeof parsed.items === "object") {
			return { version: 1, items: parsed.items };
		}
	} catch {
		/* dosya yok ya da bozuk — boş başla */
	}
	return { version: 1, items: {} };
}

// GET /api/media/alt?full_name=owner/repo[&ref=] — yol → alt/caption sözlükleri.
media.get("/alt", async (c) => {
	const user = await requireUser(c);
	if (!user) return loginRequired(c);
	const fullName = c.req.query("full_name") ?? "";
	const token = await resolveGitToken(c, fullName);
	if (!fullName || !token) {
		return c.json({ error: "invalid", message: "full_name zorunlu." }, 400);
	}
	const branch = c.req.query("ref") || (await getRepo(token, fullName)).defaultBranch;
	const meta = await readMediaMeta(token, fullName, branch);
	const alts: Record<string, string> = {};
	const captions: Record<string, string> = {};
	const focals: Record<string, { x: number; y: number }> = {};
	const widths: Record<string, number> = {};
	for (const [path, item] of Object.entries(meta.items)) {
		if (item.alt) alts[path] = item.alt;
		if (item.caption) captions[path] = item.caption;
		if (item.focal) focals[path] = item.focal;
		if (typeof item.width === "number") widths[path] = item.width;
	}
	return c.json({ alts, captions, focals, widths });
});

// PUT /api/media/alt — body: { full_name, path, alt?, caption? }.
// Alan yoksa mevcut değer korunur; ikisi de boşalınca kayıt silinir.
media.put("/alt", body(mediaAltSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return loginRequired(c);
	const payload = c.req.valid("json");
	const { full_name: fullName, path } = payload;
	const token = await resolveGitToken(c, fullName);
	if (!token) return c.json({ error: "unauthenticated", message: "GitHub bağlantısı gerekli." }, 401);
	const branch = c.req.query("ref") || (await getRepo(token, fullName)).defaultBranch;

	const meta = await readMediaMeta(token, fullName, branch);
	const existing = meta.items[path] ?? {};
	const alt = (payload.alt ?? existing.alt ?? "").trim().slice(0, 500);
	const caption = (payload.caption ?? existing.caption ?? "").trim().slice(0, 500);
	const focal =
		payload.focal === undefined
			? existing.focal
			: payload.focal === null
				? undefined
				: { x: Math.round(payload.focal.x), y: Math.round(payload.focal.y) };
	const width =
		payload.width === undefined
			? existing.width
			: payload.width === null
				? undefined
				: Math.round(payload.width);

	const item: MediaMetaItem = {};
	if (alt) item.alt = alt;
	if (caption) item.caption = caption;
	if (focal) item.focal = focal;
	if (typeof width === "number") item.width = width;
	if (Object.keys(item).length > 0) meta.items[path] = item;
	else delete meta.items[path];

	await commitFiles(
		token,
		fullName,
		branch,
		[{ path: MEDIA_META_PATH, content: `${JSON.stringify(meta, null, 2)}\n` }],
		"cms: medya bilgisi güncellendi (via WuppyCMS)",
	);
	return c.json({ ok: true, alt, caption, focal: focal ?? null, width: width ?? null });
});

// --- taşıma / yeniden adlandırma ------------------------------------------------

const MOVE_MAX_BYTES = 8 * 1024 * 1024;

// POST /api/media/move — repo: { full_name, branch, from, to }
// R2: { r2_key, to } (kova içi kopyala+sil).
media.post("/move", body(mediaMoveSchema), async (c) => {
	if (!(await requireUser(c))) return loginRequired(c);
	const payload = c.req.valid("json");
	const to = payload.to;
	if (to.endsWith("/")) {
		return c.json({ error: "invalid", message: "Geçersiz hedef yol." }, 400);
	}

	if (payload.r2_key) {
		const store = bucket(c);
		if (!store) return c.json({ error: "not_configured", message: "R2 kovası bağlı değil." }, 503);
		const from = payload.r2_key.replace(/^\/+/, "");
		if (from === to) return c.json({ error: "invalid", message: "Hedef kaynakla aynı." }, 400);
		const object = await store.get(from);
		if (!object || !object.body) return c.json({ error: "not_found", message: "Kaynak bulunamadı." }, 404);
		if ((await store.get(to)) !== null) {
			return c.json({ error: "conflict", message: `“${to}” zaten var.` }, 409);
		}
		await store.put(to, object.body, { httpMetadata: object.httpMetadata });
		await store.delete(from);
		return c.json({ ok: true, path: to });
	}

	const fullName = payload.full_name ?? "";
	const branch = payload.branch ?? "";
	const from = payload.from ?? "";
	if (!fullName || !branch || !from) {
		return c.json({ error: "invalid", message: "full_name, branch ve from zorunlu." }, 400);
	}
	if (from === to) return c.json({ error: "invalid", message: "Hedef kaynakla aynı." }, 400);
	const token = await resolveGitToken(c, fullName);
	if (!token) return c.json({ error: "unauthenticated", message: "GitHub bağlantısı gerekli." }, 401);

	const { entries, truncated } = await listTree(token, fullName, branch);
	if (truncated) return c.json({ error: "too_large", message: "Depo ağacı çok büyük; taşıma devre dışı." }, 413);
	const source = entries.find((e) => e.path === from && e.type === "blob");
	if (!source) return c.json({ error: "not_found", message: "Kaynak dosya bulunamadı." }, 404);
	if (entries.some((e) => e.path === to && e.type === "blob")) {
		return c.json({ error: "conflict", message: `“${to}” zaten var.` }, 409);
	}
	if ((source.size ?? 0) > MOVE_MAX_BYTES) {
		return c.json({ error: "too_large", message: "Taşıma için en fazla ~8 MB." }, 413);
	}
	const content = await getBlobBase64(token, fullName, source.sha);
	const name = to.split("/").pop() ?? to;
	const result = await commitFiles(
		token,
		fullName,
		branch,
		[
			{ path: to, content, base64: true },
			{ path: from, delete: true },
		],
		`cms: ${name} taşındı (via WuppyCMS)`,
	);
	if (!result) return c.json({ error: "no_changes", message: "Commit edilecek değişiklik yok." }, 400);
	return c.json({ ok: true, path: to, commit: result });
});

// --- kullanım taraması ------------------------------------------------------------

const USAGE_TEXT_EXT = /\.(mdx?|markdown|mdown|json|ya?ml|txt|astro|vue|svelte|html)$/i;
const USAGE_MAX_FILES = 150;
const USAGE_MAX_SIZE = 400_000;

// GET /api/media/usage?full_name=&path=&ref= — hangi içerikler bu dosyaya bağlı?
media.get("/usage", async (c) => {
	if (!(await requireUser(c))) return loginRequired(c);
	const fullName = c.req.query("full_name") ?? "";
	const path = (c.req.query("path") ?? "").trim();
	const ref = c.req.query("ref") || "main";
	if (!fullName || !path) return c.json({ error: "invalid", message: "full_name ve path zorunlu." }, 400);
	const token = await resolveGitToken(c, fullName);
	if (!token) return c.json({ error: "unauthenticated", message: "GitHub bağlantısı gerekli." }, 401);

	const { entries, truncated } = await listTree(token, fullName, ref);
	const base = path.split("/").pop() ?? path;
	const candidates = entries
		.filter(
			(e) =>
				e.type === "blob" &&
				USAGE_TEXT_EXT.test(e.path) &&
				(e.size ?? 0) < USAGE_MAX_SIZE &&
				// CMS iç dosyaları (site kaydı, medya manifesti) ve çöp, site
				// içeriği değildir — "kullanılan yer" sayılmazlar.
				!e.path.startsWith(".wuppycms/") &&
				!e.path.startsWith("_trash/"),
		)
		.slice(0, USAGE_MAX_FILES);

	type Use = { path: string; field: string; title: string };
	const uses: Use[] = [];
	let scanned = 0;
	for (let i = 0; i < candidates.length; i += 6) {
		const batch = candidates.slice(i, i + 6);
		const texts = await Promise.allSettled(
			batch.map((e) => getFile(token, fullName, e.path, ref).then((f) => ({ entry: e, text: f.content }))),
		);
		for (const settled of texts) {
			if (settled.status !== "fulfilled") continue;
			scanned += 1;
			const { entry, text } = settled.value;
			if (!text.includes(base)) continue;
			const line = text.split("\n").find((l) => l.includes(base)) ?? "";
			const field = /^\s*([A-Za-z][\w.-]*)\s*:/.exec(line)?.[1] ?? "gövde";
			const title = /^title:\s*["']?(.+?)["']?\s*$/im.exec(text)?.[1] ?? entry.path.split("/").pop()!;
			uses.push({ path: entry.path, field, title });
		}
	}
	return c.json({
		uses,
		scanned,
		truncated: truncated || candidates.length >= USAGE_MAX_FILES,
	});
});
