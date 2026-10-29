// EmDash Build'in "ask_questions" deseninin WuppyCMS karşılığı.
//
// EmDash her zaman aynı formu göstermez: model, brief'i okur ve **bir araç
// çağrısıyla** o işe özel 3-5 soru üretir (her seçenek kısa etiket + tek
// cümlelik açıklama + önerilen işareti taşır). Cevaplar aynı sohbette metne
// çevrilip yapım istemine eklenir.
//
// Burada aynı sözleşme uygulanır: sağlayıcıya `ask_questions` aracı verilir;
// model aracı çağırmazsa metinden JSON ayıklanır.

import type { ProviderConfig, ChatMessage, ToolSpec } from "../agent/protocol";
import { resolveProvider } from "../agent/providers";

export type QuestionOption = {
	label: string;
	/** Seçeneğin sitede neye dönüşeceğini anlatan tek cümle. */
	description?: string;
	recommended?: boolean;
};

export type ClarifyingQuestion = {
	question: string;
	why?: string;
	options?: QuestionOption[];
	allowMultiple?: boolean;
	allowCustom?: boolean;
};

export type QuestionAnswer = {
	question: string;
	selected: string[];
	custom: string;
};

export const MAX_QUESTIONS = 5;
export const MAX_OPTIONS = 5;
const MAX_QUESTION_LENGTH = 240;
const MAX_OPTION_LENGTH = 160;
const MAX_DETAIL_LENGTH = 300;

const ASK_QUESTIONS: ToolSpec = {
	name: "ask_questions",
	description: [
		"Ask the site owner a short, pick-first creative brief before building.",
		"",
		"Give each question 3 or 4 distinct, concrete options the owner can choose with one click. Each option has a short label and one sentence describing what the site will look, read or feel like with that choice. Mark the option that best fits the brief as recommended. Add a short why that says what the answer changes in the site.",
		"",
		"Never ask for operational facts such as opening hours, addresses, prices, dates or contact details; the builder never invents them and the owner adds them later. Ask a custom-only question only for an exact name the brief does not give.",
	].join("\n"),
	inputSchema: {
		type: "object",
		properties: {
			questions: {
				type: "array",
				minItems: 1,
				maxItems: MAX_QUESTIONS,
				items: {
					type: "object",
					properties: {
						question: { type: "string", description: "One warm, specific question." },
						why: { type: "string", description: "What this answer changes in the site." },
						options: {
							type: "array",
							minItems: 2,
							maxItems: MAX_OPTIONS,
							items: {
								type: "object",
								properties: {
									label: { type: "string", description: "2-6 words." },
									description: {
										type: "string",
										description: "One sentence on the result of choosing it.",
									},
									recommended: { type: "boolean" },
								},
								required: ["label"],
							},
						},
						allow_multiple: { type: "boolean" },
						allow_custom: { type: "boolean" },
					},
					required: ["question"],
				},
			},
		},
		required: ["questions"],
	},
};

const SYSTEM = [
	"You are the intake interviewer for WuppyCMS, a site builder.",
	"",
	"Your job: read the owner's brief about their business and produce a short creative brief with the `ask_questions` tool — one call, 3 to 5 questions. Do not reply in prose beyond one short sentence; call the tool.",
	"",
	"The questionnaire is the owner's creative brief, not a form. Every question must:",
	"- change something a visitor notices (headline, story, look, voice, main action, sections),",
	"- be answerable with one click, typing optional,",
	"- be decidable only by the owner (never ask what the brief already says).",
	"",
	"Choose from these layers, in order, and skip any the brief already decides:",
	"1. The name — only when the brief gives none, custom answer only (no options), asked first.",
	"2. The heart — what makes this business different; these become the headline and the story. Offer angles that fit the field, e.g. for a boiler/plumbing service: \"Same-day emergency repair\", \"Fixed-price installation\", \"Authorised combi service\", \"Family business since 1998\". Allow multiple when angles combine.",
	"3. The feel — three or four genuinely different visual directions with palette, type and photography described in one sentence.",
	"4. The voice — how the site talks.",
	"5. The main action — the one thing a visitor should do: call, request a quote, book, WhatsApp, visit.",
	"6. What it holds — pages or content areas, only when unclear.",
	"",
	"Write in the owner's language (the brief's language). Write to the owner warmly using their name: \"What's the heart of Klimacı Abi?\".",
	"",
	"Every option: label of 2-6 words and one sentence of description that lets the owner picture the result. Never use generic words like \"Modern\" or \"Classic\" alone. Mark the one option that best fits the brief as recommended. Leave custom answers on. Set allow_multiple only when choices can coexist (content areas, multiple angles) — never for feel, voice or the main action.",
	"",
	"Never ask for: opening hours, addresses, phone numbers, emails, prices, menu items, dates, team names; anything the brief already answers; implementation details (collections, fields, components, colours, fonts); permission to use stock photos.",
].join("\n");

const CONTENT_TOOL: ToolSpec = {
	name: "site_content",
	description:
		"Return the finished Turkish copy and service catalogue for the site, written for this exact business.",
	inputSchema: {
		type: "object",
		properties: {
			industry: { type: "string", description: "One word/short phrase, e.g. kombi, kuaför." },
			automotive: {
				type: "boolean",
				description: "True only when the business is about vehicles (auto/motorcycle).",
			},
			heroEyebrow: { type: "string", description: "Short uppercase kicker, max 8 words." },
			heroTitle: { type: "string", description: "Big headline, max 12 words." },
			heroDescription: { type: "string", description: "1-2 sentences, max 40 words." },
			highlights: {
				type: "array",
				maxItems: 4,
				items: { type: "string" },
				description: "Trust chips, 2-4 words each.",
			},
			metrics: {
				type: "array",
				maxItems: 3,
				items: {
					type: "object",
					properties: {
						value: { type: "string" },
						label: { type: "string" },
					},
					required: ["value", "label"],
				},
			},
			aboutTitle: { type: "string" },
			aboutText: { type: "string", description: "2-3 sentences." },
			categories: {
				type: "array",
				maxItems: 6,
				items: { type: "string" },
				description: "Service groups used for filtering.",
			},
			services: {
				type: "array",
				minItems: 6,
				maxItems: 9,
				items: {
					type: "object",
					properties: {
						title: { type: "string" },
						shortTitle: { type: "string" },
						slug: { type: "string", description: "kebab-case, ascii" },
						summary: { type: "string", description: "One sentence, max 25 words." },
						category: { type: "string" },
					},
					required: ["title", "shortTitle", "slug", "summary", "category"],
				},
			},
			faq: {
				type: "array",
				minItems: 3,
				maxItems: 5,
				items: {
					type: "object",
					properties: {
						question: { type: "string" },
						answer: { type: "string", description: "2-3 sentences." },
					},
					required: ["question", "answer"],
				},
			},
			ctaLabel: { type: "string", description: "Primary button label, e.g. 'Teklif Al'." },
		},
		required: [
			"industry",
			"heroEyebrow",
			"heroTitle",
			"heroDescription",
			"categories",
			"services",
			"faq",
		],
	},
};

const CONTENT_SYSTEM = [
	"You are the content writer for WuppyCMS.",
	"",
	"Write the finished Turkish website copy for the owner's business by calling the `site_content` tool once.",
	"",
	"Rules:",
	"- Write for the exact business in the brief: a combi/boiler service gets combi services (bakım, arıza, montaj, petek temizliği…), a hairdresser gets hair services. Never reuse another industry's services.",
	"- Services: 6 to 9 concrete services the business obviously sells. Title in Title Case, shortTitle for cards (max 4 words), summary one sentence saying what the customer gets.",
	"- FAQ: 3 to 5 questions a real customer of this business asks, answered in 2-3 sentences, in the owner's language.",
	"- Headline and description sell the business, not the CMS. Never mention WuppyCMS, Astro, Tailwind or templates.",
	"- Do not invent prices, exact addresses, opening hours or phone numbers; keep them out of the copy.",
	"- `automotive` is true only for vehicle businesses.",
	"- Match the tone from the answers (bold, minimal, warm, technical…).",
].join("\n");

function clamp(value: unknown, max: number): string {
	return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normalizeQuestions(input: unknown): ClarifyingQuestion[] {
	const raw = (input as { questions?: unknown })?.questions;
	if (!Array.isArray(raw)) return [];
	const out: ClarifyingQuestion[] = [];
	const seen = new Set<string>();
	for (const candidate of raw.slice(0, MAX_QUESTIONS * 2)) {
		if (!candidate || typeof candidate !== "object") continue;
		const item = candidate as Record<string, unknown>;
		const question = clamp(item.question, MAX_QUESTION_LENGTH);
		if (!question || seen.has(question.toLowerCase())) continue;

		const options: QuestionOption[] = [];
		let recommendedSeen = false;
		if (Array.isArray(item.options)) {
			for (const option of item.options.slice(0, MAX_OPTIONS * 2)) {
				if (!option || typeof option !== "object") continue;
				const entry = option as Record<string, unknown>;
				const label = clamp(entry.label, MAX_OPTION_LENGTH);
				if (!label) continue;
				if (options.some((existing) => existing.label === label)) continue;
				const parsed: QuestionOption = { label };
				const description = clamp(entry.description, MAX_DETAIL_LENGTH);
				if (description) parsed.description = description;
				if (entry.recommended === true && !recommendedSeen) {
					parsed.recommended = true;
					recommendedSeen = true;
				}
				options.push(parsed);
				if (options.length === MAX_OPTIONS) break;
			}
		}
		const allowCustom = typeof item.allow_custom === "boolean" ? item.allow_custom : undefined;
		if (options.length === 0 && allowCustom === false) continue;

		seen.add(question.toLowerCase());
		const why = clamp(item.why, MAX_DETAIL_LENGTH);
		out.push({
			question,
			...(why ? { why } : {}),
			...(options.length ? { options } : {}),
			allowMultiple: item.allow_multiple === true ? true : undefined,
			allowCustom,
		});
		if (out.length === MAX_QUESTIONS) break;
	}
	return out;
}

/** Araç çağrısı gelmezse metindeki ilk JSON nesnesini ayıklar. */
function jsonFromText(text: string): unknown {
	const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
	const candidate = fenced?.[1] ?? text;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(candidate.slice(start, end + 1));
	} catch {
		return null;
	}
}

function noop(): void {}

/** Brief'ten işe özel netleştirici sorular üretir. */
export async function generateQuestions(
	config: ProviderConfig,
	input: { brief: string; siteName?: string; templateName?: string },
): Promise<ClarifyingQuestion[]> {
	const provider = resolveProvider(config);
	const parts = [
		`Brief: ${input.brief.slice(0, 4_000)}`,
		input.siteName ? `Site name the owner gave: ${input.siteName}` : "",
		input.templateName ? `Design template: ${input.templateName}` : "",
	].filter(Boolean);
	const messages: ChatMessage[] = [
		{ role: "system", content: SYSTEM },
		{ role: "user", content: parts.join("\n") },
	];
	const result = await provider.runTurn(messages, [ASK_QUESTIONS], noop);
	const call = result.toolCalls.find((entry) => entry.name === ASK_QUESTIONS.name);
	const questions = normalizeQuestions(call?.args ?? jsonFromText(result.text));
	return questions;
}

export type SiteContent = {
	industry: string;
	automotive: boolean;
	heroEyebrow: string;
	heroTitle: string;
	heroDescription: string;
	highlights: string[];
	metrics: Array<{ value: string; label: string }>;
	aboutTitle: string;
	aboutText: string;
	categories: string[];
	services: Array<{
		title: string;
		shortTitle: string;
		slug: string;
		summary: string;
		category: string;
	}>;
	faq: Array<{ question: string; answer: string }>;
	ctaLabel: string;
};

function strings(value: unknown, max = 6): string[] {
	return Array.isArray(value)
		? value.map((item) => clamp(item, 120)).filter(Boolean).slice(0, max)
		: [];
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ı/g, "i")
		.replace(/ş/g, "s")
		.replace(/ğ/g, "g")
		.replace(/ü/g, "u")
		.replace(/ö/g, "o")
		.replace(/ç/g, "c")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

function normalizeContent(input: unknown): SiteContent | null {
	if (!input || typeof input !== "object") return null;
	const raw = input as Record<string, unknown>;
	const servicesRaw = Array.isArray(raw.services) ? raw.services : [];
	const services: SiteContent["services"] = [];
	for (const entry of servicesRaw.slice(0, 12)) {
		if (!entry || typeof entry !== "object") continue;
		const item = entry as Record<string, unknown>;
		const title = clamp(item.title, 120);
		const summary = clamp(item.summary, 300);
		const category = clamp(item.category, 60);
		if (!title || !summary) continue;
		const slug = slugify(clamp(item.slug, 80) || title);
		if (!slug || services.some((existing) => existing.slug === slug)) continue;
		services.push({
			title,
			shortTitle: clamp(item.shortTitle, 60) || title,
			slug,
			summary,
			category: category || "Hizmetler",
		});
	}
	if (services.length < 3) return null;

	const faq: SiteContent["faq"] = [];
	for (const entry of Array.isArray(raw.faq) ? raw.faq.slice(0, 6) : []) {
		if (!entry || typeof entry !== "object") continue;
		const item = entry as Record<string, unknown>;
		const question = clamp(item.question, 200);
		const answer = clamp(item.answer, 600);
		if (question && answer) faq.push({ question, answer });
	}

	const metrics: SiteContent["metrics"] = [];
	for (const entry of Array.isArray(raw.metrics) ? raw.metrics.slice(0, 3) : []) {
		if (!entry || typeof entry !== "object") continue;
		const item = entry as Record<string, unknown>;
		const value = clamp(item.value, 24);
		const label = clamp(item.label, 48);
		if (value && label) metrics.push({ value, label });
	}

	const categories = strings(raw.categories, 6);
	for (const service of services) {
		if (!categories.includes(service.category)) categories.push(service.category);
	}

	return {
		industry: clamp(raw.industry, 60) || "işletme",
		automotive: raw.automotive === true,
		heroEyebrow: clamp(raw.heroEyebrow, 90),
		heroTitle: clamp(raw.heroTitle, 140),
		heroDescription: clamp(raw.heroDescription, 320),
		highlights: strings(raw.highlights, 4),
		metrics,
		aboutTitle: clamp(raw.aboutTitle, 140),
		aboutText: clamp(raw.aboutText, 700),
		categories,
		services,
		faq,
		ctaLabel: clamp(raw.ctaLabel, 40) || "Teklif Al",
	};
}

/** Cevapları yapım istemine eklenecek metne çevirir (EmDash ile aynı biçim). */
export function formatAnswers(answers: QuestionAnswer[]): string {
	const answered = answers.flatMap((answer) => {
		const values = [...answer.selected.map((value) => value.trim()).filter(Boolean)];
		if (answer.custom.trim()) values.push(answer.custom.trim());
		return values.length ? [`S: ${answer.question}\nC: ${values.join(", ")}`] : [];
	});
	if (!answered.length) return "";
	const missing = answered.length < answers.length ? "\n\nAtladığım sorularda önerdiğin varsayılanları kullan." : "";
	return `Kullanıcının cevapları:\n\n${answered.join("\n\n")}${missing}`;
}

/** Brief + cevaplardan sitenin nihai içeriğini üretir. */
export async function generateSiteContent(
	config: ProviderConfig,
	input: {
		brief: string;
		siteName: string;
		tagline: string;
		templateName: string;
		answers: QuestionAnswer[];
	},
): Promise<SiteContent | null> {
	const provider = resolveProvider(config);
	const user = [
		`İşletme / site adı: ${input.siteName}`,
		`Kısa açıklama: ${input.tagline}`,
		`Brief: ${input.brief.slice(0, 4_000)}`,
		`Tasarım şablonu: ${input.templateName}`,
		formatAnswers(input.answers),
	]
		.filter(Boolean)
		.join("\n\n");
	const messages: ChatMessage[] = [
		{ role: "system", content: CONTENT_SYSTEM },
		{ role: "user", content: user },
	];
	const result = await provider.runTurn(messages, [CONTENT_TOOL], noop);
	const call = result.toolCalls.find((entry) => entry.name === CONTENT_TOOL.name);
	return normalizeContent(call?.args ?? jsonFromText(result.text));
}
