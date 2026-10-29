// BYO AI — sağlayıcı ayarı (D1, anahtar şifreli) ve içerik üretimi (P5).
// Anahtar tarayıcıya hiç inmez ve repoya yazılmaz; worker sağlayıcıya gider.
// İki şekil desteklenir: OpenAI-uyumlu (OpenAI/Groq/OpenRouter/Ollama…, baseUrl
// serbest) ve Gemini. Ollama gibi yerel sunucular anahtarsız çalışabilir.

import { Hono } from "hono";
import { decryptToken, encryptToken } from "../lib/crypto";
import type { AppEnv } from "./types";
import { platform, requireUser } from "./helpers";
import { aiGenerateSchema, aiSettingsSchema, body } from "./schemas";

export const ai = new Hono<{ Bindings: AppEnv }>();

type Provider = "openai" | "gemini" | "anthropic";

type SettingsRow = {
	provider: Provider;
	base_url: string;
	model: string;
	api_key_encrypted: string | null;
};

const DEFAULTS: Omit<SettingsRow, "api_key_encrypted"> = {
	provider: "openai",
	base_url: "https://api.openai.com/v1",
	model: "gpt-4o-mini",
};

/** Sağlayıcı değişince uygulanacak varsayılan adres/model. */
const PROVIDER_DEFAULTS: Record<Provider, { baseUrl: string; model: string }> = {
	openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
	gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash" },
	anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
};

function normalizeProvider(value: unknown): Provider {
	if (value === "gemini") return "gemini";
	if (value === "anthropic") return "anthropic";
	return "openai";
}

// GET /api/ai/settings — anahtar SIZMAZ; yalnız "kayıtlı mı" bilgisi döner.
ai.get("/settings", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ ...DEFAULTS, hasKey: false });
	const row = await db.prepare(
		"SELECT provider, base_url, model, api_key_encrypted FROM ai_settings WHERE user_id = ?",
	)
		.bind(user.id)
		.first<SettingsRow>();
	return c.json({
		provider: row?.provider ?? DEFAULTS.provider,
		baseUrl: row?.base_url ?? DEFAULTS.base_url,
		model: row?.model ?? DEFAULTS.model,
		hasKey: Boolean(row?.api_key_encrypted),
	});
});

// PUT /api/ai/settings — { provider, baseUrl, model, apiKey? }.
// apiKey: undefined → mevcut korunur; "" → silinir; dolu → şifrelenip yazılır.
ai.put("/settings", body(aiSettingsSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured", message: "D1 bağlı değil." }, 503);
	const payload = c.req.valid("json");
	const provider = normalizeProvider(payload.provider);
	const defaults = PROVIDER_DEFAULTS[provider];
	const baseUrl = (payload.baseUrl ?? defaults.baseUrl).replace(/\/+$/, "") || defaults.baseUrl;
	const model = payload.model || defaults.model;

	const existing = await db.prepare("SELECT api_key_encrypted FROM ai_settings WHERE user_id = ?")
		.bind(user.id)
		.first<{ api_key_encrypted: string | null }>();

	let encrypted: string | null;
	if (payload.apiKey === undefined) {
		encrypted = existing?.api_key_encrypted ?? null;
	} else if (payload.apiKey.trim() === "") {
		encrypted = null;
	} else {
		encrypted = await encryptToken(payload.apiKey.trim(), c.env.TOKEN_ENCRYPTION_KEY);
	}

	await db.prepare(
		`INSERT INTO ai_settings (user_id, provider, base_url, model, api_key_encrypted, updated_at)
		 VALUES (?, ?, ?, ?, ?, datetime('now'))
		 ON CONFLICT(user_id) DO UPDATE SET
		   provider = excluded.provider, base_url = excluded.base_url,
		   model = excluded.model, api_key_encrypted = excluded.api_key_encrypted,
		   updated_at = excluded.updated_at`,
	)
		.bind(user.id, provider, baseUrl, model, encrypted)
		.run();
	return c.json({ ok: true, provider, baseUrl, model, hasKey: Boolean(encrypted) });
});

/** Üretim istemini sağlayıcıdan bağımsız kurar (Wryte 7/9: ton/uzunluk/dil/anahtar sözcük). */
export function buildMessages(input: {
	prompt: string;
	tone?: string;
	length?: string;
	language?: string;
	keyword?: string;
	title?: string;
}): { system: string; user: string } {
	const tone =
		{ professional: "profesyonel ve net", friendly: "samimi ve sıcak", casual: "günlük ve rahat", formal: "resmî" }[
			input.tone ?? ""
		] ?? "profesyonel ve net";
	const length = { short: "yaklaşık 150", medium: "yaklaşık 400", long: "yaklaşık 800" }[input.length ?? ""] ?? "yaklaşık 400";
	const language = input.language === "en" ? "İngilizce" : "Türkçe";
	const system = [
		"Sen bir içerik editörüsün. Yalnızca Markdown gövdesi üret; başlık (frontmatter) yazma.",
		`Ton: ${tone}. Uzunluk: ${length} kelime. Dil: ${language}.`,
		input.keyword ? `Şu anahtar sözcüğü doğal biçimde kullan: "${input.keyword}".` : "",
		"Uydurma bilgi verme; emin olmadığın yerde genel ifade kullan.",
	]
		.filter(Boolean)
		.join("\n");
	const user = [input.title ? `Yazı başlığı: ${input.title}` : "", input.prompt.trim()]
		.filter(Boolean)
		.join("\n\n");
	return { system, user };
}

type ProviderCall = { text: string };

/** Sağlayıcı çağrısı — OpenAI-uyumlu ya da Gemini; hatalar anlamlı mesaja çevrilir. */
export async function callProvider(
	settings: { provider: Provider; baseUrl: string; model: string; apiKey: string },
	messages: { system: string; user: string },
): Promise<ProviderCall> {
	const { provider, baseUrl, model, apiKey } = settings;
	if (provider === "gemini") {
		const url = `${baseUrl.replace(/\/v1beta$/, "")}/v1beta/models/${encodeURIComponent(model)}:generateContent${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ""}`;
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: messages.system }] },
				contents: [{ role: "user", parts: [{ text: messages.user }] }],
			}),
		});
		const data = (await res.json().catch(() => null)) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
			error?: { message?: string };
		} | null;
		if (!res.ok) {
			throw new Error(data?.error?.message ?? `Sağlayıcı hatası (${res.status})`);
		}
		const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
		if (!text) throw new Error("Sağlayıcı boş yanıt döndü.");
		return { text };
	}

	if (provider === "anthropic") {
		const url = `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/messages`;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model,
				max_tokens: 4096,
				system: messages.system,
				messages: [{ role: "user", content: [{ type: "text", text: messages.user }] }],
			}),
		});
		const data = (await res.json().catch(() => null)) as {
			content?: Array<{ type?: string; text?: string }>;
			error?: { message?: string };
		} | null;
		if (!res.ok) {
			throw new Error(data?.error?.message ?? `Sağlayıcı hatası (${res.status})`);
		}
		const text = (data?.content ?? [])
			.filter((part) => part.type === "text")
			.map((part) => part.text ?? "")
			.join("");
		if (!text) throw new Error("Sağlayıcı boş yanıt döndü.");
		return { text };
	}

	const res = await fetch(`${baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: "system", content: messages.system },
				{ role: "user", content: messages.user },
			],
			temperature: 0.7,
		}),
	});
	const data = (await res.json().catch(() => null)) as {
		choices?: { message?: { content?: string } }[];
		error?: { message?: string };
	} | null;
	if (!res.ok) {
		throw new Error(data?.error?.message ?? `Sağlayıcı hatası (${res.status})`);
	}
	const text = data?.choices?.[0]?.message?.content ?? "";
	if (!text) throw new Error("Sağlayıcı boş yanıt döndü.");
	return { text };
}

// POST /api/ai/generate — { prompt, tone?, length?, language?, keyword?, title? }.
ai.post("/generate", body(aiGenerateSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const payload = c.req.valid("json");
	const prompt = payload.prompt;

	if (!db) return c.json({ error: "ai_not_configured", message: "Sağlayıcı ayarlı değil." }, 400);
	const row = await db.prepare(
		"SELECT provider, base_url, model, api_key_encrypted FROM ai_settings WHERE user_id = ?",
	)
		.bind(user.id)
		.first<SettingsRow>();
	const apiKey = row?.api_key_encrypted
		? await decryptToken(row.api_key_encrypted, c.env.TOKEN_ENCRYPTION_KEY)
		: "";
	// Anahtarsız yalnız yerel/uyumlu sunucular (ör. Ollama) çalışabilir: baseUrl
	// varsayılandan farklıysa anahtarsız da deneyelim; aksi hâlde ayar isteyelim.
	const isLocal = Boolean(row && row.base_url && row.base_url !== DEFAULTS.base_url);
	if (!row || (!apiKey && !isLocal)) {
		return c.json(
			{ error: "ai_not_configured", message: "Sağlayıcı ayarlı değil — Ajan ile kullan → Sağlayıcı sekmesinden ekleyin." },
			400,
		);
	}

	try {
		const messages = buildMessages({ ...payload, prompt });
		const result = await callProvider(
			{ provider: row.provider, baseUrl: row.base_url, model: row.model, apiKey },
			messages,
		);
		return c.json({ text: result.text, provider: row.provider, model: row.model });
	} catch (error) {
		return c.json(
			{ error: "provider_failed", message: error instanceof Error ? error.message : "Sağlayıcı çağrısı başarısız." },
			502,
		);
	}
});
