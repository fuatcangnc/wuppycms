// Ajan sözleşmesi — widget ile backend arasındaki tipler (ADR 0008).
// Olay adları turan-widget'ın sözleşmesiyle uyumludur; UI polling ile tüketir.

export type AgentEvent =
	| { type: "run_started"; ts: string; provider: string; model: string }
	| { type: "assistant_text_delta"; ts: string; text: string }
	| { type: "assistant_text_done"; ts: string; text: string }
	| { type: "tool_started"; ts: string; callId: string; name: string; args: unknown }
	| { type: "tool_done"; ts: string; callId: string; name: string; ok: boolean; summary: string }
	/** Bir içerik/dosya değişikliği kaydedildi; UI "Geri al" düğmesi gösterir. */
	| { type: "content_changed"; ts: string; changeId: string; kind: string; path: string; label: string }
	| { type: "run_finished"; ts: string }
	| { type: "run_error"; ts: string; message: string };

export type StoredMessage = {
	role: "user" | "assistant" | "tool";
	text: string;
	ts: string;
	toolName?: string;
	/** Bu mesajı üreten turda yapılan değişiklikler (mesaj bazlı geri al). */
	changeIds?: string[];
};

export type AgentSession = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messages: StoredMessage[];
};

export type SessionSummary = {
	id: string;
	title: string;
	updatedAt: string;
	messageCount: number;
};

export type AgentStatus = {
	dev: boolean;
	/** Kayıtlı sağlayıcı ayarı (anahtar sızmaz). */
	configured: boolean;
	provider: "openai" | "gemini" | "anthropic" | null;
	model: string | null;
	baseUrl: string | null;
	/** Seçilebilir modeller (kayıtlı sağlayıcıya göre). */
	models: Array<{ id: string; label: string; provider: string; model: string }>;
};

export type PageItem = { url: string; title: string };

/** Element seçici köprüsünden gelen bağlam. */
export type SelectionContext = {
	tag?: string;
	label?: string;
	text?: string;
	html?: string;
	path?: string;
	/** Yeni bölüm seçili elementin öncesine mi sonrasına mı eklenecek. */
	position?: "before" | "after";
	/** site-template'in eklediği içerik hedefi (varsa). */
	content?: { collection?: string; slug?: string; field?: string } | null;
};

export type PromptContext = {
	/** Admin'de açık doküman (varsa). */
	document?: { collection: string; path: string } | null;
	/** Önizlemede gösterilen sayfa yolu. */
	pagePath?: string | null;
	selections?: SelectionContext[];
	/** Önizleme köprüsü aktif mi. */
	bridge?: boolean;
};

export type ToolSpec = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; args: unknown };

export type ChatMessage =
	| { role: "system"; content: string }
	| { role: "user"; content: string }
	| { role: "assistant"; content: string; toolCalls?: ToolCall[] }
	| { role: "tool"; toolCallId: string; name: string; content: string };

export type TurnResult = { text: string; toolCalls: ToolCall[] };

export interface Provider {
	readonly id: "openai" | "gemini" | "anthropic";
	readonly model: string;
	runTurn(
		messages: ChatMessage[],
		tools: ToolSpec[],
		onText: (delta: string) => void,
	): Promise<TurnResult>;
}

/** Sağlayıcı fabrikası için çözülmüş ayar (anahtar yalnız bellekte). */
export type ProviderConfig = {
	provider: "openai" | "gemini" | "anthropic";
	baseUrl: string;
	model: string;
	apiKey: string;
};
