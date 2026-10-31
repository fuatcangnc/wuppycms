// İyimser önizleme yaması: ajanın `edit_file` çağrısındaki oldString/newString
// farkından görünür metin değişiklikleri çıkarır ve iframe DOM'una uygular.
// Böylece build (1–2 dk) beklemeden nokta/kelime değişiklikleri anında görünür.

import type { ToolChip } from "../types";

export type TextPatch =
	| { kind: "replace"; find: string; replace: string }
	| { kind: "insertAfter"; find: string; insert: string }
	| { kind: "remove"; find: string };

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

/** Tek bir old→new çiftinden DOM yaması üretir. */
export function patchFromStrings(oldString: string, newString: string): TextPatch | null {
	if (oldString === newString) return null;
	const prefix = commonPrefix(oldString, newString);
	const suffix = commonSuffix(oldString, newString, prefix);
	const removed = oldString.slice(prefix, oldString.length - suffix);
	const added = newString.slice(prefix, newString.length - suffix);

	// Silme: çıkarılan parça görünür metinse.
	if (!added && removed && visible(removed)) {
		return { kind: "remove", find: removed };
	}
	// Ekleme: önceki bağlamın son parçasını çapa al.
	if (added && !removed) {
		const anchor = oldString.slice(Math.max(0, prefix - 48), prefix).trim();
		if (anchor && visible(anchor) && visible(added)) {
			return { kind: "insertAfter", find: anchor, insert: added };
		}
		return null;
	}
	// Değiştirme: görünür metin parçaları.
	if (removed && added && visible(removed) && visible(added)) {
		return { kind: "replace", find: removed, replace: added };
	}
	return null;
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
				text.nodeValue = value.split(patch.find).join(patch.replace);
				applied += 1;
			} else if (patch.kind === "remove") {
				if (!value.includes(patch.find)) continue;
				text.nodeValue = value.split(patch.find).join("");
				applied += 1;
			} else {
				const at = value.lastIndexOf(patch.find);
				if (at < 0) continue;
				const end = at + patch.find.length;
				text.nodeValue = value.slice(0, end) + patch.insert + value.slice(end);
				applied += 1;
			}
		}
	}
	return applied;
}
