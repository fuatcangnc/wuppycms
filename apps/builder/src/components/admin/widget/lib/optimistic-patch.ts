// İyimser önizleme yaması: ajanın `edit_file` çağrısındaki oldString/newString
// farkından görünür metin değişiklikleri çıkarır ve iframe DOM'una uygular.
// Böylece build (1–2 dk) beklemeden nokta/kelime değişiklikleri anında görünür.

import type { ToolChip } from "../types";

export type TextPatch =
	| { kind: "replace"; find: string; replace: string }
	| { kind: "insertAfter"; find: string; insert: string }
	| { kind: "remove"; find: string };

/**
 * Kaynaktaki görünür parçaları sırayla çıkarır: string literalleri ve template
 * literal içindeki sabit metinler. `${...}` içindeki literal de kendi
 * parçasıdır; böylece `'başlık'` ile `` `${... 'başlık'}.` `` eşleşir.
 */
function visibleFragments(source: string): string[] {
	const found: Array<{ index: number; text: string }> = [];
	let rest = source;

	for (const match of source.matchAll(/`([^`]*)`/g)) {
		const content = match[1] ?? "";
		let text = "";
		let last = 0;
		for (const inner of content.matchAll(/\$\{([^}]*)\}/g)) {
			text += content.slice(last, inner.index);
			const quoted = [...(inner[1] ?? "").matchAll(/'([^']*)'|"([^"]*)"/g)]
				.map((q) => q[1] ?? q[2] ?? "")
				.join(" ");
			text += quoted;
			last = inner.index + inner[0].length;
		}
		text += content.slice(last);
		const clean = text.replace(/\s+/g, " ").trim();
		if (clean) found.push({ index: match.index ?? 0, text: clean });
		if (match.index !== undefined) rest = rest.replace(match[0], " ".repeat(match[0].length));
	}

	for (const match of rest.matchAll(/'([^']*)'|"([^"]*)"/g)) {
		const text = (match[1] ?? match[2] ?? "").replace(/\s+/g, " ").trim();
		if (text) found.push({ index: match.index ?? 0, text });
	}

	return found.sort((a, b) => a.index - b.index).map((item) => item.text);
}

function commonPrefix(a: string, b: string): number {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
	return i;
}

function commonSuffix(a: string, b: string, prefix: number): number {
	let i = 0;
	while (
		i < a.length - prefix &&
		i < b.length - prefix &&
		a[a.length - 1 - i] === b[b.length - 1 - i]
	) {
		i += 1;
	}
	return i;
}

function visible(text: string): boolean {
	return /[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(text);
}

/** Tek bir görünür metin çiftinden DOM yaması üretir. */
function patchFromPair(oldText: string, newText: string): TextPatch | null {
	if (oldText === newText) return null;
	const prefix = commonPrefix(oldText, newText);
	const suffix = commonSuffix(oldText, newText, prefix);
	const removed = oldText.slice(prefix, oldText.length - suffix);
	const added = newText.slice(prefix, newText.length - suffix);

	if (!added && removed && visible(removed)) {
		return { kind: "remove", find: removed };
	}
	if (added && !removed) {
		const anchor = oldText.slice(Math.max(0, prefix - 48), prefix).trim();
		if (anchor && visible(anchor)) {
			return { kind: "insertAfter", find: anchor, insert: added };
		}
		return null;
	}
	if (removed && added && visible(removed) && visible(added)) {
		return { kind: "replace", find: removed, replace: added };
	}
	return null;
}

/** old→new kaynak çiftinden, eşleşen görünür parçaların farkını çıkarır. */
export function patchFromStrings(oldSource: string, newSource: string): TextPatch | null {
	if (oldSource === newSource) return null;
	const before = visibleFragments(oldSource);
	const after = visibleFragments(newSource);

	if (before.length && before.length === after.length) {
		for (let i = 0; i < before.length; i += 1) {
			if (before[i] === after[i]) continue;
			const patch = patchFromPair(before[i], after[i]);
			if (patch) return patch;
		}
		return null;
	}

	// Parça çıkmadıysa (düz metin) veya sayılar farklıysa ham metni dene.
	const oldText = (before.join(" ") || oldSource).trim();
	const newText = (after.join(" ") || newSource).trim();
	if (!oldText || !newText) return null;
	return patchFromPair(oldText, newText);
}

export function patchesFromTools(tools: ToolChip[]): TextPatch[] {
	const patches: TextPatch[] = [];
	for (const tool of tools) {
		if (tool.name !== "edit_file" || tool.ok === false) continue;
		const args = tool.args as { oldString?: unknown; newString?: unknown } | null;
		if (!args || typeof args.oldString !== "string" || typeof args.newString !== "string") continue;
		const patch = patchFromStrings(args.oldString, args.newString);
		if (patch) patches.push(patch);
	}
	return patches.slice(0, 8);
}

const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

/** Yamaları DOM metin düğümlerine uygular; uygulanan yama sayısını döner. */
export function applyPatches(doc: Document, patches: TextPatch[]): number {
	if (!patches.length) return 0;
	const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	let node = walker.nextNode();
	while (node) {
		const parent = (node as Text).parentElement;
		if (parent && !SKIP.has(parent.tagName)) nodes.push(node as Text);
		node = walker.nextNode();
	}

	let applied = 0;
	for (const patch of patches) {
		for (const text of nodes) {
			const value = text.nodeValue ?? "";
			if (patch.kind === "replace") {
				if (!value.includes(patch.find)) continue;
				// Yalnızca ilk eşleşme: aynı kelimenin sayfadaki diğer geçişlerini bozma.
				text.nodeValue = value.replace(patch.find, patch.replace);
				applied += 1;
				break;
			} else if (patch.kind === "remove") {
				if (!value.includes(patch.find)) continue;
				text.nodeValue = value.replace(patch.find, "");
				applied += 1;
				break;
			} else {
				const at = value.lastIndexOf(patch.find);
				if (at < 0) continue;
				const end = at + patch.find.length;
				// Noktalama işareti araya boşlukla girmesin.
				const insert = /^[.,!?:;]/.test(patch.insert.trimStart())
					? patch.insert.trimStart()
					: patch.insert;
				text.nodeValue = value.slice(0, end) + insert + value.slice(end);
				applied += 1;
				break;
			}
		}
	}
	return applied;
}
