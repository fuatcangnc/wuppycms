// GitHub App kurulum ve webhook uçları.
//
// Akış: kullanıcı /api/github/app/install → GitHub'da app'i kurar → GitHub
// setup URL'e installation_id ile döner → burada kullanıcıya bağlanır.
// Repo işlemleri için installation token'ı lib/git/github/app.ts üretir.

import { Hono } from "hono";
import {
	getInstallation,
	listInstallationRepos,
	verifyWebhook,
} from "../lib/git/github/app";
import type { AppEnv } from "./types";
import { platform, requireUser } from "./helpers";

export const githubApp = new Hono<{ Bindings: AppEnv }>();

githubApp.get("/install", async (c) => {
	const user = await requireUser(c);
	if (!user) {
		return c.redirect(`/login?next=${encodeURIComponent("/api/github/app/install")}`);
	}
	const slug = c.env.GITHUB_APP_SLUG || "wuppycms";
	return c.redirect(`https://github.com/apps/${slug}/installations/new`);
});

githubApp.get("/setup", async (c) => {
	const user = await requireUser(c);
	if (!user) {
		const base = (c.env.BETTER_AUTH_URL || new URL(c.req.url).origin).replace(/\/+$/, "");
		const next = `${base}/api/github/app/setup?${new URL(c.req.url).searchParams.toString()}`;
		return c.redirect(`/login?next=${encodeURIComponent(next)}`);
	}
	const installationId = c.req.query("installation_id");
	if (!installationId) {
		return c.redirect("/projects?github_app=missing");
	}
	const db = platform(c).db;
	if (!db) return c.redirect("/projects?github_app=no_db");

	let accountLogin: string | null = null;
	let accountType: string | null = null;
	let selection: string | null = null;
	try {
		const installation = await getInstallation(c.env, installationId);
		accountLogin = installation.account.login;
		accountType = installation.account.type;
		selection = installation.repository_selection;
	} catch {
		// App private key henüz yoksa kurulumu yine de kaydet.
	}

	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO github_installations
				(id, user_id, installation_id, account_login, account_type, repository_selection, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, installation_id) DO UPDATE SET
				account_login = excluded.account_login,
				account_type = excluded.account_type,
				repository_selection = excluded.repository_selection,
				updated_at = excluded.updated_at`,
		)
		.bind(
			crypto.randomUUID(),
			user.id,
			installationId,
			accountLogin,
			accountType,
			selection,
			now,
			now,
		)
		.run();

	return c.redirect("/projects?github_app=installed");
});

githubApp.get("/status", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ installations: [] });
	const rows = await db
		.prepare(
			`SELECT installation_id, account_login, account_type, repository_selection, created_at
			 FROM github_installations WHERE user_id = ? ORDER BY created_at DESC`,
		)
		.bind(user.id)
		.all<{
			installation_id: string;
			account_login: string | null;
			account_type: string | null;
			repository_selection: string | null;
			created_at: string;
		}>();
	return c.json({ installations: rows.results ?? [] });
});

githubApp.get("/repos", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ repos: [] });
	const rows = await db
		.prepare(`SELECT installation_id FROM github_installations WHERE user_id = ?`)
		.bind(user.id)
		.all<{ installation_id: string }>();

	const repos = [];
	for (const row of rows.results ?? []) {
		try {
			repos.push(...(await listInstallationRepos(c.env, row.installation_id)));
		} catch {
			// private key yoksa ya da kurulum kaldırıldıysa atla
		}
	}
	return c.json({ repos });
});

githubApp.post("/webhook", async (c) => {
	const raw = await c.req.text();
	const ok = await verifyWebhook(c.env, raw, c.req.header("x-hub-signature-256"));
	if (!ok) return c.json({ error: "invalid_signature" }, 401);

	const event = c.req.header("x-github-event");
	let payload: {
		action?: string;
		installation?: {
			id: number;
			account?: { login?: string; type?: string };
			repository_selection?: string;
		};
	};
	try {
		payload = JSON.parse(raw);
	} catch {
		return c.json({ error: "invalid_json" }, 400);
	}

	const db = platform(c).db;
	const installation = payload.installation;
	if (db && installation?.id) {
		const installationId = String(installation.id);
		if (event === "installation" && payload.action === "deleted") {
			await db
				.prepare(`DELETE FROM github_installations WHERE installation_id = ?`)
				.bind(installationId)
				.run();
		} else if (event === "installation" && payload.action === "created") {
			await db
				.prepare(
					`UPDATE github_installations
					 SET account_login = ?, account_type = ?, repository_selection = ?, updated_at = ?
					 WHERE installation_id = ?`,
				)
				.bind(
					installation.account?.login ?? null,
					installation.account?.type ?? null,
					installation.repository_selection ?? null,
					new Date().toISOString(),
					installationId,
				)
				.run();
		}
	}

	return c.json({ ok: true });
});
