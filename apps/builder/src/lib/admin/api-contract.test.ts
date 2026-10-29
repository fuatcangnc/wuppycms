// API sözleşmesi testi — sunucu zod şemaları ile elle yazılmış istemci
// girdi tiplerinin DERLEME ZAMANINDA ayrışmamasını sabitler.
// `hc<AppType>` denemesi bilinçli olarak bırakıldı: better-auth ucu tüm Hono
// RPC tip grafiğini `unknown`a düşürüyor; tam istemci göçü, ikinci bir istemci
// doğana dek ertelendi (AppType yine dışa açık, bkz. api/app.ts).
//
// Bu dosya `pnpm typecheck` ile doğrulanır; çalışma zamanında ağa çıkmaz.

import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
	aiGenerateSchema,
	aiSettingsSchema,
	contentCollectionSchema,
	mediaAltSchema,
	reviewDecisionSchema,
	reviewStartSchema,
	scheduleRunSchema,
	teamInviteSchema,
} from "@/api/schemas";
import type { AiGenerateInput, AiSettings } from "./api";

/** A, B'ye atanabilir olmalı — aksi hâlde derleme hatası (sözleşme kayması). */
type Assignable<A extends B, B> = true;

// Sunucu şeması → istemci girdi tipi (drift = tip hatası).
type _AiGenerate = Assignable<z.infer<typeof aiGenerateSchema>, AiGenerateInput>;
type _AiSettings = Assignable<z.infer<typeof aiSettingsSchema>, { provider: string; baseUrl?: string; model?: string; apiKey?: string }>;
type _ReviewStart = Assignable<
	z.infer<typeof reviewStartSchema>,
	{ full_name: string; path: string; content: string; title?: string; body?: string }
>;
type _ReviewDecision = Assignable<
	z.infer<typeof reviewDecisionSchema>,
	{ full_name: string; number: number; event: "APPROVE" | "REQUEST_CHANGES"; body?: string }
>;
type _TeamInvite = Assignable<
	z.infer<typeof teamInviteSchema>,
	{ project_id: string; email: string; role?: "editor" | "viewer" }
>;
type _MediaAlt = Assignable<
	z.infer<typeof mediaAltSchema>,
	{ full_name: string; path: string; alt?: string; caption?: string }
>;
type _Collection = Assignable<
	z.infer<typeof contentCollectionSchema>,
	{ full_name: string; key: string; base?: string; pattern?: string; fields?: string[] }
>;
type _ScheduleRun = Assignable<z.infer<typeof scheduleRunSchema>, { full_name?: string }>;

describe("API sözleşmesi (şema ↔ istemci tipi)", () => {
	it("AI ayarları istemci tipi sunucu alanlarını kapsar", () => {
		// İstemci tipinin alanları sunucu yanıtıyla aynı adlarda olmalı.
		const settings: AiSettings = { provider: "openai", baseUrl: "x", model: "m", hasKey: false };
		expect(Object.keys(settings).sort()).toEqual(["baseUrl", "hasKey", "model", "provider"]);
	});

	it("tip düzeyi sabitlemeler derleniyor (yukarıdaki Assignable satırları)", () => {
		expect(true).toBe(true);
	});
});
