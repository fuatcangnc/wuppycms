// Astro sayfaları için sunucu tarafı oturum okuma.
// sayfa frontmatter'ında: const session = await getSession(Astro);
// koruma: const session = await getSession(Astro); if (!session) return Astro.redirect("/login");

import { env as cfEnv } from "cloudflare:workers";
import type { APIContext } from "astro";
import { createAuth } from "./auth";
import type { AppEnv } from "../api/types";

type SessionResult = {
	session: { id: string; expiresAt: Date | string } | null;
	user: { id: string; name?: string; email?: string; image?: string | null } | null;
} | null;

/** Worker bağlamı. Astro v6+ locals.runtime.env'i kaldırdı; artık
 *  cloudflare:workers üzerinden doğrudan okunur. */
export function getEnv(_context?: APIContext): AppEnv {
	return cfEnv as unknown as AppEnv;
}

export async function getSession(context: APIContext): Promise<SessionResult> {
	try {
		return await createAuth(getEnv(context)).api.getSession({
			headers: context.request.headers,
		});
	} catch {
		return null;
	}
}
