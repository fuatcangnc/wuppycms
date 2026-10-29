-- BYO AI (P5): kullanıcı başına sağlayıcı ayarı. API anahtarı ŞİFRELİ saklanır
-- (TOKEN_ENCRYPTION_KEY; lib/crypto.ts) — repoya asla girmez (ADR 0006: repo
-- içerik içindir, sırlar platformdadır).
CREATE TABLE IF NOT EXISTS ai_settings (
	user_id TEXT PRIMARY KEY,
	-- 'openai' (OpenAI-uyumlu: OpenAI, Groq, OpenRouter, Ollama…) | 'gemini'
	provider TEXT NOT NULL DEFAULT 'openai',
	base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
	model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
	api_key_encrypted TEXT,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
