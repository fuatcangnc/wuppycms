// Araştırma notları — makale başına kaynak/fikir listesi (Wryte "Research"
// paritesi). ADR 0006 gereği repo'da yaşar: `.wuppycms/research/<koleksiyon>/
// <slug>.md`. Format düz markdown: `- ` / `* ` ile başlayan satırlar nottur;
// diğer satırlar (başlık vb.) yok sayılır — elle düzenlemeye dayanıklı.

/** Doküman yolundan araştırma dosyası yolunu üretir.
 *  `src/content/blog/x.mdx` → `.wuppycms/research/blog/x.md` */
export function researchPathFor(docPath: string): string {
	const relative = docPath.replace(/^src\/content\//, "");
	const withoutExt = relative.replace(/\.\w+$/, "");
	return `.wuppycms/research/${withoutExt}.md`;
}

const HEADER = "# Araştırma notları (WuppyCMS)";

/** Markdown'dan notları çıkarır (sırayla; `- `/`* ` madde işaretleri). */
export function parseResearchNotes(markdown: string): string[] {
	const notes: string[] = [];
	for (const line of markdown.split("\n")) {
		const match = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
		if (match) notes.push(match[1]!);
	}
	return notes;
}

/** Notları markdown'a çevirir; boş liste yalnız başlık içeren dosya üretir.
 *  Notlar tek satırdır: satır sonları boşluğa indirgenir. */
export function serializeResearchNotes(notes: string[]): string {
	const lines = notes
		.map((note) => `- ${note.replace(/\s+/g, " ").trim()}`)
		.filter((line) => line !== "-");
	return lines.length ? `${HEADER}\n\n${lines.join("\n")}\n` : `${HEADER}\n`;
}
