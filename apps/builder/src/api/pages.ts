// Astro sayfaları — `src/pages` altındaki .astro/.md/.mdx/.html dosyaları.
// İçerik deposu repodur; bu uç yalnız yolları listeler (ADR 0006).

import { Hono } from "hono";
import { getRepo, listTree } from "../lib/git";
import type { AppEnv } from "./types";
import { requireQuery, resolveGitToken, unauthorized } from "./helpers";

export const pages = new Hono<{ Bindings: AppEnv }>();

const PREFIX = "src/pages/";
const PAGE_RE = /\.(astro|md|mdx|html)$/i;

// GET /api/pages?full_name=owner/repo[&ref=branch]
pages.get("/", async (c) => {
	const token = await resolveGitToken(c);
	if (!token) return unauthorized(c);
	const fullName = requireQuery(c, "full_name");
	const branch = c.req.query("ref") || (await getRepo(token, fullName)).defaultBranch;
	const tree = await listTree(token, fullName, branch, true);
	const files = tree.entries
		.filter((entry) => entry.type === "blob" && entry.path.startsWith(PREFIX) && PAGE_RE.test(entry.path))
		.map((entry) => ({ path: entry.path.slice(PREFIX.length), size: entry.size ?? 0 }))
		.sort((a, b) => a.path.localeCompare(b.path));
	return c.json({ ref: branch, pages: files, truncated: tree.truncated });
});
