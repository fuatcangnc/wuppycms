// API yardımcılarını paylaşan modül — git/content/proje route'ları aynı
// kimlik çözümünü kullanır.

import type { Context } from "hono";
import { createAuth, findGitHubToken } from "../lib/auth";
import { BackendError } from "../lib/git";
import { getInstallationToken } from "../lib/git/github/app";
import { installationForOwner, listInstallations } from "../lib/git/github/installations";
import { splitFullName } from "../lib/git/github/api";
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

/** Git erişiminin kaynağı — tanı mesajları ve repo sahibi seçimi için. */
export type GitAuthKind = "env" | "app" | "oauth";

export type GitAuth = {
	token: string;
	kind: GitAuthKind;
	/** Kurulum token'ında kurulumun hesabı; diğerlerinde null. */
	installationId?: string;
	accountLogin?: string;
};

/**
 * Git işlemleri için kimlik çözümü (öncelik sırası):
 * 1) GitHub App installation token'ı — repo sahibinin kurulumu varsa
 * 2) Geliştirme kolaylığı — env.GITHUB_TOKEN
 * 3) Oturumdaki kullanıcının GitHub access token'ı (account tablosu)
 *
 * `fullName` verilirse o repo sahibine ait kurulum aranır; verilmezse
 * kullanıcının ilk kurulumu kullanılır.
 */
export async function resolveGitAuth(
	c: ApiContext,
	fullName?: string,
): Promise<GitAuth | null> {
	const db = platform(c).db;
	const session = db
		? await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
		: null;

	if (
		db &&
		session &&
		c.env.GITHUB_APP_ID &&
		c.env.GITHUB_APP_PRIVATE_KEY_B64
	) {
		let installation = null;
		if (fullName) {
			try {
				installation = await installationForOwner(
					db,
					session.user.id,
					splitFullName(fullName).owner,
				);
			} catch {
				// geçersiz full_name → kurulum yok say
			}
		} else {
			// Repo bağlamı yoksa kullanıcının ilk kurulumu (repo listesi gibi
			// sahip-bağımsız çağrılar için).
			const all = await listInstallations(db, session.user.id);
			installation = all[0] ?? null;
		}
		if (installation) {
			try {
				const token = await getInstallationToken(c.env, installation.installationId);
				return {
					token,
					kind: "app",
					installationId: installation.installationId,
					accountLogin: installation.accountLogin || undefined,
				};
			} catch (error) {
				// Private key bozuksa ya da kurulum kaldırıldıysa aşağıdaki
				// yollara düş — kullanıcıyı tamamen kilitlemeyiz.
				console.warn("[git] installation token alınamadı:", error);
			}
		}
	}

	if (c.env.GITHUB_TOKEN) return { token: c.env.GITHUB_TOKEN, kind: "env" };
	if (!db || !session) return null;
	const token = await findGitHubToken(db, session.user.id);
	return token ? { token, kind: "oauth" } : null;
}

/**
 * Git işlemleri için token çözümü.
 * 1) GitHub App installation token'ı (repo sahibinin kurulumu)
 * 2) Geliştirme kolaylığı — env.GITHUB_TOKEN
 * 3) Oturumdaki kullanıcının GitHub access token'ı (account tablosu)
 */
export async function resolveGitToken(
	c: ApiContext,
	fullName?: string,
): Promise<string | null> {
	return (await resolveGitAuth(c, fullName))?.token ?? null;
}

/** Yalnızca kullanıcının OAuth token'ı (GitHub App token'ı değil). */
export async function resolveOAuthToken(c: ApiContext): Promise<string | null> {
	const db = platform(c).db;
	if (!db) return null;
	const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
	if (!session) return null;
	return findGitHubToken(db, session.user.id);
}

export function unauthorized(c: ApiContext): Response {
	return c.json(
		{
			error: "github_not_connected",
			message:
				"GitHub bağlantısı yok. WuppyCMS GitHub App'ini kurun ya da GitHub hesabıyla giriş yapın; " +
				"geliştirmede .dev.vars içine GITHUB_TOKEN eklenebilir.",
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
