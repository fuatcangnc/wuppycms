// API yardımcılarını paylaşan modül — git/content/proje route'ları aynı
// kimlik çözümünü kullanır.

import type { Context } from "hono";
import { createAuth, findGitHubToken } from "../lib/auth";
import { BackendError } from "../lib/git";
import { platformFromBindings, type Platform } from "../lib/platform";
import type { AppEnv } from "./types";

export type ApiContext = Context<{ Bindings: AppEnv }>;

/**
 * Platform adaptörleri (ADR 0006) — route'lar `c.env.DB`/`c.env.MEDIA_R2`
 * yerine bu dikişi kullanır; Cloudflare bağlamaları referans adaptördür.
 * Self-host, aynı arayüzleri uygulayan kendi bağlamalarını verir.
 */
export function platform(c: ApiContext): Platform {
	return platformFromBindings(c.env);
}

/**
 * Git işlemleri için token çözümü:
 * 1) Geliştirme kolaylığı — env.GITHUB_TOKEN
 * 2) Oturumdaki kullanıcının GitHub access token'ı (account tablosu)
 */
export async function resolveGitToken(c: ApiContext): Promise<string | null> {
	if (c.env.GITHUB_TOKEN) return c.env.GITHUB_TOKEN;
	const db = platform(c).db;
	if (!db) return null;
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return null;
	return findGitHubToken(db, session.user.id);
}

export function unauthorized(c: ApiContext): Response {
	return c.json(
		{
			error: "github_not_connected",
			message:
				"GitHub bağlantısı yok. Geliştirmede .dev.vars içine GITHUB_TOKEN ekleyin; " +
				"üretimde GitHub hesabıyla giriş yapın.",
		},
		401,
	);
}

export function requireQuery(c: ApiContext, name: string): string {
	const value = c.req.query(name);
	if (!value) {
		throw new BackendError(400, `Eksik parametre: ${name}`);
	}
	return value;
}

/** better-auth oturumunun kullanıcısını döndürür (yoksa null).
 *  Auth bağlaması bilinçli olarak platform dikişinin dışındadır: better-auth
 *  kendi DB adaptörünü ister; self-host kendi adaptörünü verir (ADR 0006). */
export async function requireUser(c: ApiContext) {
	if (!platform(c).db) return null;
	const session = await createAuth(c.env).api.getSession({
		headers: c.req.raw.headers,
	});
	return session?.user ?? null;
}
