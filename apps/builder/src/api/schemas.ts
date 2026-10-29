// API gövde şemaları (zod) + ortak zValidator kancası — yazma uçlarında elle
// `await c.req.json().catch(...)` yerine tipli, gerekçeli 400 döner.

import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { z } from "zod";

/** Doğrulama hatasını Türkçe, alan adlı ve 400'lük biçime çevirir. */
export const zodHook = (
	result: { success: true } | { success: false; error: z.ZodError },
	c: Context,
) => {
	if (result.success) return;
	const message = result.error.issues
		.map((issue) => `${issue.path.join(".") || "gövde"}: ${issue.message}`)
		.join(" · ");
	return c.json({ error: "invalid", message: `Geçersiz istek — ${message}` }, 400);
};

/** `zValidator("json", schema, zodHook)` kısayolu. */
export const body = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, zodHook);

// --- ortak parçalar ---------------------------------------------------------------

const fullName = z
	.string()
	.trim()
	.regex(/^[^/\s]+\/[^/\s]+$/, "owner/repo biçiminde olmalı");
const safePath = z.string().trim().min(1, "yol boş olamaz").refine((p) => !p.includes(".."), "yol '..' içeremez");
const role = z.enum(["editor", "viewer"]);

// --- medya ------------------------------------------------------------------------

export const mediaAltSchema = z.object({
	full_name: fullName,
	path: safePath,
	alt: z.string().optional(),
	caption: z.string().optional(),
	focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).nullable().optional(),
	width: z.number().min(5).max(100).nullable().optional(),
});

export const mediaMoveSchema = z.object({
	full_name: fullName.optional(),
	branch: z.string().trim().min(1).optional(),
	from: safePath.optional(),
	to: safePath,
	r2_key: z.string().trim().min(1).optional(),
});

// --- içerik -----------------------------------------------------------------------

export const contentEntrySchema = z.object({
	full_name: fullName,
	collection: z.string().trim().min(1),
	title: z.string().trim().min(1, "başlık zorunlu"),
	slug: z.string().trim().optional(),
});

export const contentCollectionSchema = z.object({
	full_name: fullName,
	key: z.string().trim().regex(/^[a-zA-Z][\w-]*$/, "harfle başlamalı (harf, sayı, tire)"),
	base: z.string().trim().optional(),
	pattern: z.string().trim().optional(),
	fields: z.array(z.string().regex(/^[a-zA-Z_][\w]*$/)).max(12).optional(),
});

// --- site -------------------------------------------------------------------------

export const siteConfigSchema = z.object({
	full_name: fullName,
	sites: z.array(z.record(z.unknown())).min(1, "en az bir site girdisi gerekli"),
});

// --- zamanlama / AI ---------------------------------------------------------------

export const scheduleRunSchema = z.object({ full_name: fullName.optional() });

export const aiSettingsSchema = z.object({
	provider: z.enum(["openai", "gemini", "anthropic"]),
	baseUrl: z.string().trim().max(300).optional(),
	model: z.string().trim().max(200).optional(),
	/** undefined → mevcut korunur; "" → silinir; dolu → şifrelenip yazılır. */
	apiKey: z.string().max(500).optional(),
});

// --- ajan (ADR 0008) ---------------------------------------------------------------

const agentProvider = z.enum(["openai", "gemini", "anthropic"]);

export const agentPromptSchema = z.object({
	full_name: fullName,
	branch: z.string().trim().max(200).optional(),
	sessionId: z.string().trim().max(128).optional(),
	message: z.string().trim().min(1, "mesaj boş olamaz").max(32_000),
	provider: agentProvider.optional(),
	model: z.string().trim().max(200).optional(),
	context: z
		.object({
			document: z
				.object({ collection: z.string().trim().max(100), path: z.string().trim().max(500) })
				.nullable()
				.optional(),
			pagePath: z.string().trim().max(1_000).nullable().optional(),
			bridge: z.boolean().optional(),
			selections: z
				.array(
					z.object({
						tag: z.string().max(80).optional(),
						label: z.string().max(200).optional(),
						text: z.string().max(2_000).optional(),
						html: z.string().max(4_000).optional(),
						path: z.string().max(1_000).optional(),
						position: z.enum(["before", "after"]).optional(),
						content: z
							.object({
								collection: z.string().max(100).optional(),
								slug: z.string().max(300).optional(),
								field: z.string().max(100).optional(),
							})
							.nullable()
							.optional(),
					}),
				)
				.max(8)
				.optional(),
		})
		.optional(),
});

export const agentSessionSchema = z.object({
	sessionId: z.string().trim().min(1).max(128),
});

export const agentEventSchema = z.object({ sessionId: z.string().trim().min(1).max(128) });

export const agentUndoSchema = z.object({
	full_name: fullName,
	branch: z.string().trim().max(200).optional(),
	changeId: z.string().trim().max(80).optional(),
});

export const aiGenerateSchema = z.object({
	prompt: z.string().trim().min(1, "istem boş olamaz").max(8000),
	tone: z.enum(["professional", "friendly", "casual", "formal"]).optional(),
	length: z.enum(["short", "medium", "long"]).optional(),
	language: z.enum(["tr", "en"]).optional(),
	keyword: z.string().trim().max(120).optional(),
	title: z.string().trim().max(300).optional(),
});

// --- ekip -------------------------------------------------------------------------

export const teamInviteSchema = z.object({
	project_id: z.string().trim().min(1),
	email: z.string().trim().toLowerCase().email("geçerli bir e-posta girin"),
	role: role.optional(),
});

export const teamAcceptSchema = z.object({ token: z.string().trim().min(1) });

export const teamRemoveSchema = z.object({
	project_id: z.string().trim().min(1),
	user_id: z.string().trim().min(1),
});

export const teamRevokeSchema = z.object({
	project_id: z.string().trim().min(1),
	invitation_id: z.string().trim().min(1),
});

// --- inceleme ---------------------------------------------------------------------

export const reviewStartSchema = z.object({
	full_name: fullName,
	path: safePath,
	content: z.string().min(1, "içerik boş olamaz"),
	title: z.string().trim().max(300).optional(),
	body: z.string().max(4000).optional(),
});

export const reviewDecisionSchema = z.object({
	full_name: fullName,
	number: z.number().int().positive(),
	event: z.enum(["APPROVE", "REQUEST_CHANGES"]),
	body: z.string().max(4000).optional(),
});

export const reviewNumberSchema = z.object({
	full_name: fullName,
	number: z.number().int().positive(),
});

// --- projeler ---------------------------------------------------------------------

export const projectCreateSchema = z.object({
	full_name: fullName,
	name: z.string().trim().max(200).optional(),
});

// --- "With AI" yeni site üretimi ------------------------------------------------

export const buildSiteSchema = z.object({
	prompt: z.string().trim().min(10, "site açıklaması en az 10 karakter").max(4_000),
	siteName: z.string().trim().min(1).max(80),
	tagline: z.string().trim().min(1).max(160),
	repoName: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(/^[A-Za-z0-9._-]+$/, "repo adı yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir"),
	/** GitHub App kurulumunun hesabı (ör. bir organizasyon); yoksa ilk kurulum. */
	owner: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(/^[A-Za-z0-9._-]+$/, "geçersiz hesap adı")
		.optional(),
	/** `karakas` | `starter` — boşsa ilk şablon. */
	template: z.string().trim().max(40).optional(),
	private: z.boolean().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-f]{6}$/i)
		.optional(),
	/** Eski biçim (soru → metin) ya da yeni dinamik cevap listesi. */
	answers: z
		.union([
			z.record(z.string(), z.string()),
			z.array(
				z.object({
					question: z.string().trim().min(1).max(300),
					selected: z.array(z.string().max(200)).max(8).default([]),
					custom: z.string().max(1_000).default(""),
				}),
			),
		])
		.optional(),
});

export const buildQuestionsSchema = z.object({
	prompt: z.string().trim().min(10, "site açıklaması en az 10 karakter").max(4_000),
	siteName: z.string().trim().max(80).optional(),
	template: z.string().trim().max(40).optional(),
});
