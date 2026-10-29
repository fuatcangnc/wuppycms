// Satır bazlı diff — P2 sürüm karşılaştırma. Klasik LCS; belge boyutundaki
// dosyalar için fazlasıyla yeterli. Çok büyük dosyada (nadir) önce/son ortak
// bloklar kırpılır, orta bölüm "tümü değişti" kabul edilir — dürüst kısayol.

export type DiffRow = {
	type: "same" | "add" | "del";
	oldLine?: number;
	newLine?: number;
	text: string;
};

/** LCS tablosuyla ayrıştırılacak üst sınır; üzeri kaba moda düşer. */
const MAX_LINES = 1500;

/** Ortak önek/sonek dışındaki bölgeyi del+add olarak işaretler. */
function coarseDiff(a: string[], b: string[]): DiffRow[] {
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA -= 1;
		endB -= 1;
	}
	const rows: DiffRow[] = [];
	for (let i = 0; i < start; i += 1) rows.push({ type: "same", oldLine: i + 1, newLine: i + 1, text: a[i]! });
	for (let i = start; i < endA; i += 1) rows.push({ type: "del", oldLine: i + 1, text: a[i]! });
	for (let j = start; j < endB; j += 1) rows.push({ type: "add", newLine: j + 1, text: b[j]! });
	for (let i = endA, j = endB; i < a.length; i += 1, j += 1) {
		rows.push({ type: "same", oldLine: i + 1, newLine: j + 1, text: a[i]! });
	}
	return rows;
}

/** İki metni satır satır karşılaştırır (eski → yeni yönünde). */
export function diffLines(oldText: string, newText: string): DiffRow[] {
	const a = oldText.split("\n");
	const b = newText.split("\n");
	if (a.length > MAX_LINES || b.length > MAX_LINES) return coarseDiff(a, b);

	const width = b.length + 1;
	const table = new Uint32Array((a.length + 1) * width);
	for (let i = a.length - 1; i >= 0; i -= 1) {
		for (let j = b.length - 1; j >= 0; j -= 1) {
			table[i * width + j] =
				a[i] === b[j]
					? table[(i + 1) * width + j + 1]! + 1
					: Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
		}
	}

	const rows: DiffRow[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			rows.push({ type: "same", oldLine: i + 1, newLine: j + 1, text: a[i]! });
			i += 1;
			j += 1;
		} else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
			rows.push({ type: "del", oldLine: i + 1, text: a[i]! });
			i += 1;
		} else {
			rows.push({ type: "add", newLine: j + 1, text: b[j]! });
			j += 1;
		}
	}
	while (i < a.length) {
		rows.push({ type: "del", oldLine: i + 1, text: a[i]! });
		i += 1;
	}
	while (j < b.length) {
		rows.push({ type: "add", newLine: j + 1, text: b[j]! });
		j += 1;
	}
	return rows;
}

/** Özet: kaç satır eklendi/silindi. */
export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
	let added = 0;
	let removed = 0;
	for (const row of rows) {
		if (row.type === "add") added += 1;
		else if (row.type === "del") removed += 1;
	}
	return { added, removed };
}
