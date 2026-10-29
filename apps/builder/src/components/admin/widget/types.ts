/** Widget'ın yerel görünüm modelleri. */

export type Tab = { url: string; title: string };

export type ToolChip = {
	callId: string;
	name: string;
	args: unknown;
	ok?: boolean;
	summary?: string;
	running: boolean;
};

export type PageItem = { url: string; title: string };

/** Önizleme köprüsünden gelen seçim. */
export type PickedElement = {
	tag: string;
	label: string;
	text: string;
	html: string;
	path: string;
	/** Yeni bölümün seçili elemente göre konumu. */
	position?: "before" | "after";
	content?: { collection?: string; slug?: string; field?: string } | null;
};

/** Çalışan koşu sırasında sıraya alınan kullanıcı istemi. */
export type QueuedPrompt = { id: string; text: string };

export type ModelChoice = {
	id: string;
	label: string;
	provider: "openai" | "gemini" | "anthropic";
	model: string;
};
