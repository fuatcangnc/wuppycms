// Site adreslerini repoya yazan yardımcı.
//
// İki yerde yaşar:
//  - `.wuppycms/sites.jsonc` → admin'in kullandığı erişilebilir önizleme URL'i,
//  - `astro.config.mjs` → sitenin kanonik (pages.dev) adresi.
//
// Build akışı ve "yeniden yayınla" (deploy sync) aynı fonksiyonu kullanır.

import { commitFiles, getFile } from "../git";
import { BackendError } from "../git/backend";

export type SiteUrlUpdate = {
	/** Admin önizlemesi (aynı origin proxy). */
	previewUrl: string | null;
	/** Kanonik site adresi. */
	siteUrl: string | null;
};

/**
 * Verilen adresleri repoya işler. Değişiklik yoksa commit atmaz.
 * Dönüş: güncellenen dosya sayısı.
 */
export async function writeSiteUrls(
	token: string,
	fullName: string,
	branch: string,
	urls: SiteUrlUpdate,
): Promise<number> {
	const files: { path: string; content: string }[] = [];

	if (urls.previewUrl) {
		try {
			const file = await getFile(token, fullName, ".wuppycms/sites.jsonc", branch);
			let next = file.content;
			if (/"url"\s*:/.test(next)) {
				next = next.replace(/"url"\s*:\s*"[^"]*"/, `"url": ${JSON.stringify(urls.previewUrl)}`);
			} else if (/"name"\s*:/.test(next)) {
				next = next.replace(
					/("name"\s*:\s*"[^"]*",)/,
					`$1\n\t\t\t"url": ${JSON.stringify(urls.previewUrl)},`,
				);
			}
			if (next !== file.content) files.push({ path: ".wuppycms/sites.jsonc", content: next });
		} catch (error) {
			if (!(error instanceof BackendError && error.status === 404)) throw error;
		}
	}

	if (urls.siteUrl) {
		try {
			const file = await getFile(token, fullName, "astro.config.mjs", branch);
			const siteLine = `site: ${JSON.stringify(urls.siteUrl)}`;
			let next = file.content;
			if (/site:\s*["'][^"']*["']/.test(next)) {
				next = next.replace(/site:\s*["'][^"']*["']/, siteLine);
			} else {
				next = next.replace(
					/export default defineConfig\(\{/,
					`export default defineConfig({\n\t${siteLine},`,
				);
			}
			if (next !== file.content) files.push({ path: "astro.config.mjs", content: next });
		} catch (error) {
			if (!(error instanceof BackendError && error.status === 404)) throw error;
		}
	}

	if (!files.length) return 0;
	await commitFiles(
		token,
		fullName,
		branch,
		files,
		"chore: site adresleri güncellendi (via WuppyCMS)",
	);
	return files.length;
}
