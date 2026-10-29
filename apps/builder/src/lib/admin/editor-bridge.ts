// Editör köprüsü — panel bileşenlerinin (Outline/Research) mdxeditor'a
// dokunmadan gövdeye markdown eklemesi için küçük istek atomu. MdxBodyEditor
// abone olur ve ref üzerinden `insertMarkdown` çağırır.

import { atom } from "nanostores";

export type InsertRequest = { markdown: string; id: number };

export const $insertRequest = atom<InsertRequest | null>(null);

/** Gövdeye imleç konumuna markdown ekler (MdxBodyEditor tüketir). */
export function insertMarkdownIntoEditor(markdown: string): void {
	$insertRequest.set({ markdown, id: Date.now() });
}
