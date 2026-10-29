// LLM sağlayıcıları — OpenAI-uyumlu (OpenAI/Groq/OpenRouter/Ollama…),
// Anthropic ve Gemini. Anahtar yalnız bellekte; loglanmaz (ADR 0006/0008).
// Tool-calling sözleşmesi sağlayıcıdan bağımsız ChatMessage/ToolSpec'tir.

import type { Provider, ProviderConfig, ToolCall } from "./protocol";
const MAX_TOKENS = 8_192;

export const PROVIDER_DEFAULTS = {
	openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
	gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash" },
	anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
} as const;

/** Sağlayıcıya göre seçilebilir modeller (widget model menüsü). */
export const MODEL_CATALOG: Record<
	"openai" | "gemini" | "anthropic",
	Array<{ id: string; label: string }>
> = {
	openai: [
		{ id: "gpt-4o-mini", label: "GPT-4o mini" },
		{ id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
		{ id: "gpt-4.1", label: "GPT-4.1" },
		{ id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
	],
	gemini: [
		{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
		{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
	],
	anthropic: [
		{ id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
		{ id: "claude-opus-4-1", label: "Claude Opus 4.1" },
		{ id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
	],
};

async function fail(res: Response, label: string): Promise<never> {
	let detail = "";
	try {
		detail = (await res.text()).slice(0, 600);
	} catch {
		// gövde tüketilmiş
	}
	throw new Error(`${label} API hatası ${res.status}: ${detail || res.statusText}`);
}

async function* readSse(res: Response): AsyncGenerator<Record<string, unknown>> {
	const reader = res.body?.getReader();
	if (!reader) return;
	const decoder = new TextDecoder();
	let buffer = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let sep: number;
		while ((sep = buffer.indexOf("\n\n")) >= 0) {
			const chunk = buffer.slice(0, sep);
			buffer = buffer.slice(sep + 2);
			for (const line of chunk.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const payload = trimmed.slice(5).trim();
				if (!payload || payload === "[DONE]") continue;
				try {
					yield JSON.parse(payload) as Record<string, unknown>;
				} catch {
					// keep-alive
				}
			}
		}
	}
}

interface Acc {
	id: string;
	name: string;
	json: string;
}

function parseArgs(json: string): unknown {
	try {
		return json ? JSON.parse(json) : {};
	} catch {
		return { _raw: json };
	}
}

function openAiCompatible(baseUrl: string, apiKey: string, model: string): Provider {
	return {
		id: "openai",
		model,
		async runTurn(messages, tools, onText) {
			const converted: Array<Record<string, unknown>> = [];
			for (const message of messages) {
				if (message.role === "system" || message.role === "user") {
					converted.push({ role: message.role, content: message.content });
				} else if (message.role === "assistant") {
					converted.push({
						role: "assistant",
						content: message.content || null,
						...(message.toolCalls?.length
							? {
									tool_calls: message.toolCalls.map((call) => ({
										id: call.id,
										type: "function",
										function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
									})),
								}
							: {}),
					});
				} else {
					converted.push({
						role: "tool",
						tool_call_id: message.toolCallId,
						content: message.content,
					});
				}
			}
			const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
				},
				body: JSON.stringify({
					model,
					messages: converted,
					...(tools.length
						? {
								tools: tools.map((tool) => ({
									type: "function",
									function: {
										name: tool.name,
										description: tool.description,
										parameters: tool.inputSchema,
									},
								})),
							}
						: {}),
					stream: true,
				}),
			});
			if (!res.ok) await fail(res, "OpenAI");

			let text = "";
			const accs = new Map<number, Acc>();
			for await (const chunk of readSse(res)) {
				const choice = (chunk.choices as Array<Record<string, unknown>> | undefined)?.[0];
				const delta = choice?.delta as Record<string, unknown> | undefined;
				if (typeof delta?.content === "string" && delta.content) {
					text += delta.content;
					onText(delta.content);
				}
				for (const call of (delta?.tool_calls as Array<Record<string, unknown>> | undefined) ?? []) {
					const index = (call.index as number) ?? 0;
					const acc = accs.get(index) ?? { id: "", name: "", json: "" };
					if (typeof call.id === "string") acc.id = call.id;
					const fn = call.function as Record<string, unknown> | undefined;
					if (typeof fn?.name === "string") acc.name = fn.name;
					if (typeof fn?.arguments === "string") acc.json += fn.arguments;
					accs.set(index, acc);
				}
			}
			return {
				text,
				toolCalls: [...accs.values()]
					.filter((acc) => acc.name)
					.map((acc, i) => ({
						id: acc.id || `call_${i}`,
						name: acc.name,
						args: parseArgs(acc.json),
					})),
			};
		},
	};
}

function anthropicProvider(apiKey: string, model: string): Provider {
	return {
		id: "anthropic",
		model,
		async runTurn(messages, tools, onText) {
			const system = messages
				.filter((message) => message.role === "system")
				.map((message) => (message as { content: string }).content)
				.join("\n\n");
			const converted: Array<Record<string, unknown>> = [];
			for (const message of messages) {
				if (message.role === "system") continue;
				if (message.role === "user") {
					converted.push({ role: "user", content: [{ type: "text", text: message.content }] });
				} else if (message.role === "assistant") {
					const blocks: Array<Record<string, unknown>> = [];
					if (message.content) blocks.push({ type: "text", text: message.content });
					for (const call of message.toolCalls ?? []) {
						blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.args });
					}
					converted.push({ role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "" }] });
				} else {
					converted.push({
						role: "user",
						content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }],
					});
				}
			}
			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model,
					max_tokens: MAX_TOKENS,
					...(system ? { system } : {}),
					messages: converted,
					...(tools.length
						? {
								tools: tools.map((tool) => ({
									name: tool.name,
									description: tool.description,
									input_schema: tool.inputSchema,
								})),
							}
						: {}),
					stream: true,
				}),
			});
			if (!res.ok) await fail(res, "Anthropic");

			let text = "";
			const blocks = new Map<number, Acc>();
			for await (const evt of readSse(res)) {
				if (evt.type === "content_block_start") {
					const block = evt.content_block as Record<string, unknown> | undefined;
					if (block?.type === "tool_use") {
						blocks.set(evt.index as number, {
							id: String(block.id ?? ""),
							name: String(block.name ?? ""),
							json: "",
						});
					}
				} else if (evt.type === "content_block_delta") {
					const delta = evt.delta as Record<string, unknown> | undefined;
					if (delta?.type === "text_delta" && typeof delta.text === "string") {
						text += delta.text;
						onText(delta.text);
					} else if (delta?.type === "input_json_delta") {
						const acc = blocks.get(evt.index as number);
						if (acc && typeof delta.partial_json === "string") acc.json += delta.partial_json;
					}
				} else if (evt.type === "error") {
					const err = evt.error as Record<string, unknown> | undefined;
					throw new Error(`Anthropic akış hatası: ${String(err?.message ?? "bilinmeyen")}`);
				}
			}
			return {
				text,
				toolCalls: [...blocks.values()].map((acc) => ({
					id: acc.id,
					name: acc.name,
					args: parseArgs(acc.json),
				})),
			};
		},
	};
}

/** Gemini — generateContent (non-stream). Metin tek parça olarak iletilir. */
function geminiProvider(baseUrl: string, apiKey: string, model: string): Provider {
	const root = baseUrl
		.replace(/\/+$/, "")
		.replace(/\/v1beta$/, "")
		.replace(/\/v1$/, "") || "https://generativelanguage.googleapis.com";
	return {
		id: "gemini",
		model,
		async runTurn(messages, tools, onText) {
			const system = messages
				.filter((message) => message.role === "system")
				.map((message) => (message as { content: string }).content)
				.join("\n\n");
			const contents: Array<Record<string, unknown>> = [];
			for (const message of messages) {
				if (message.role === "system") continue;
				if (message.role === "user") {
					contents.push({ role: "user", parts: [{ text: message.content }] });
				} else if (message.role === "assistant") {
					const parts: Array<Record<string, unknown>> = [];
					if (message.content) parts.push({ text: message.content });
					for (const call of message.toolCalls ?? []) {
						parts.push({ functionCall: { name: call.name, args: call.args ?? {} } });
					}
					contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });
				} else {
					contents.push({
						role: "user",
						parts: [{ functionResponse: { name: message.name, response: { content: message.content } } }],
					});
				}
			}
			const url = `${root}/v1beta/models/${encodeURIComponent(model)}:generateContent${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ""}`;
			const res = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
					contents,
					...(tools.length
						? {
								tools: [
									{
										functionDeclarations: tools.map((tool) => ({
											name: tool.name,
											description: tool.description,
											parameters: tool.inputSchema,
										})),
									},
								],
							}
						: {}),
					generationConfig: { maxOutputTokens: MAX_TOKENS },
				}),
			});
			const data = (await res.json().catch(() => null)) as {
				candidates?: Array<{
					content?: { parts?: Array<Record<string, unknown>> };
					finishReason?: string;
				}>;
				error?: { message?: string };
			} | null;
			if (!res.ok) {
				throw new Error(`Gemini API hatası ${res.status}: ${data?.error?.message ?? res.statusText}`);
			}
			const parts = data?.candidates?.[0]?.content?.parts ?? [];
			let text = "";
			const toolCalls: ToolCall[] = [];
			for (const part of parts) {
				if (typeof part.text === "string") text += part.text;
				const call = part.functionCall as { name?: string; args?: unknown } | undefined;
				if (call?.name) {
					toolCalls.push({
						id: `gemini_${toolCalls.length}_${Date.now().toString(36)}`,
						name: call.name,
						args: call.args ?? {},
					});
				}
			}
			if (text) onText(text);
			return { text, toolCalls };
		},
	};
}

export function resolveProvider(config: ProviderConfig): Provider {
	if (config.provider === "anthropic") {
		if (!config.apiKey) throw new Error("Anthropic seçili ama API anahtarı yok.");
		return anthropicProvider(config.apiKey, config.model || PROVIDER_DEFAULTS.anthropic.model);
	}
	if (config.provider === "gemini") {
		return geminiProvider(
			config.baseUrl || PROVIDER_DEFAULTS.gemini.baseUrl,
			config.apiKey,
			config.model || PROVIDER_DEFAULTS.gemini.model,
		);
	}
	return openAiCompatible(
		config.baseUrl || PROVIDER_DEFAULTS.openai.baseUrl,
		config.apiKey,
		config.model || PROVIDER_DEFAULTS.openai.model,
	);
}

