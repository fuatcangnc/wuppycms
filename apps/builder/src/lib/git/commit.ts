// Commit hazırlama — TuranCMS'teki prepareCommit deseninin sadeleştirilmiş hâli:
// aynı yolu son yazan kazanır, içeriği olmayan (ve silme olmayan) girdiler düşer,
// mesaj normalize edilir.

import type { CommitAuthor, CommitFile } from "@wuppycms/shared";

export type PreparedCommit = {
	files: CommitFile[];
	message: string;
};

/** Yol bazında tekilleştirir; sonraki girdi öncekini ezer. */
function dedupeFiles(files: CommitFile[]): CommitFile[] {
	const byPath = new Map<string, CommitFile>();
	for (const file of files) {
		const path = file.path.trim().replace(/^\/+/, "");
		if (!path) continue;
		byPath.set(path, { ...file, path });
	}
	return [...byPath.values()];
}

/** İçeriği olmayan yazma girdileri ve silme bayrağı boş olanlar düşer. */
function filterWritable(files: CommitFile[]): CommitFile[] {
	return files.filter((file) => (file.delete ? true : typeof file.content === "string"));
}

/** Boş mesajı yola göre türetir; co-author satırını ekler. */
function normalizeMessage(
	message: string,
	files: CommitFile[],
	coAuthor?: CommitAuthor,
): string {
	let text = message.trim();
	if (!text) {
		const paths = files.map((f) => f.path);
		const verb = files.every((f) => f.delete) ? "Delete" : "Update";
		text = paths.length === 1 ? `${verb} ${paths[0]}` : `${verb} ${paths.length} files`;
	}
	if (coAuthor) {
		const trailer = `Co-authored-by: ${coAuthor.name} <${coAuthor.email}>`;
		if (!text.includes(trailer)) text = `${text}\n\n${trailer}`;
	}
	return text;
}

/** Commit'a girecek dosya listesini ve mesajı hazırlar; boşsa null döner. */
export function prepareCommit(
	files: CommitFile[],
	message: string,
	coAuthor?: CommitAuthor,
): PreparedCommit | null {
	const prepared = filterWritable(dedupeFiles(files));
	if (prepared.length === 0) return null;
	return { files: prepared, message: normalizeMessage(message, prepared, coAuthor) };
}
