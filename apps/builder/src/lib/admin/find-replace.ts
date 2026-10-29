// Bul & Değiştir + kelime sayımı — saf fonksiyonlar (Wryte "Find & Replace" ve
// kelime sayacı paritesi). Regex kaçışı gerektirmeyen indexOf tabanlı; büyük/
// küçük harf duyarlılığı seçilebilir.

/** Metindeki eşleşme sayısı (boş sorgu → 0). */
export function countMatches(text: string, query: string, caseSensitive = false): number {
	if (!query) return 0;
	const haystack = caseSensitive ? text : text.toLocaleLowerCase("tr");
	const needle = caseSensitive ? query : query.toLocaleLowerCase("tr");
	let count = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = haystack.indexOf(needle, index + needle.length);
	}
	return count;
}

/** İlk eşleşmeyi değiştirir; bulunamazsa metin aynen döner. */
export function replaceFirst(
	text: string,
	query: string,
	replacement: string,
	caseSensitive = false,
): { text: string; replaced: boolean } {
	if (!query) return { text, replaced: false };
	const haystack = caseSensitive ? text : text.toLocaleLowerCase("tr");
	const needle = caseSensitive ? query : query.toLocaleLowerCase("tr");
	const index = haystack.indexOf(needle);
	if (index === -1) return { text, replaced: false };
	return {
		text: `${text.slice(0, index)}${replacement}${text.slice(index + query.length)}`,
		replaced: true,
	};
}

/** Tüm eşleşmeleri değiştirir; kaç değişiklik yapıldığını döner. */
export function replaceAllMatches(
	text: string,
	query: string,
	replacement: string,
	caseSensitive = false,
): { text: string; count: number } {
	if (!query) return { text, count: 0 };
	const haystack = caseSensitive ? text : text.toLocaleLowerCase("tr");
	const needle = caseSensitive ? query : query.toLocaleLowerCase("tr");
	let out = "";
	let cursor = 0;
	let count = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		out += text.slice(cursor, index) + replacement;
		cursor = index + query.length;
		count += 1;
		index = haystack.indexOf(needle, cursor);
	}
	out += text.slice(cursor);
	return { text: out, count };
}

/** Kelime sayımı — boşlukla ayrılmış diziler (boş metin → 0). */
export function countWords(text: string): number {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}
