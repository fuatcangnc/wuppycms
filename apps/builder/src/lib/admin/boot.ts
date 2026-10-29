// SSR açılış tohumu — Astro sayfaları ilk ekranın verisini sunucuda çeker
// (bkz. boot-ssr.ts) ve adaya `boot` olarak verir; buradaki kayıt ilk
// tüketimde eşleşmeyi döndürür (ağ gidiş-dönüşü yok). Sonraki gezinme ve
// tazelemeler normal /api yolunda kalır (ADR 0005'in ilk-okuma istisnası).

import type { GitFile } from "@wuppycms/shared";
import type { CommitInfo, EntryRow, PullRequestRow, ScanResult } from "./api";
import { queryClient } from "./queryClient";
import type { Site } from "./store";

/** /api/media/alt yanıtı — depo üst metinleri (alt/caption/odak/genişlik). */
export type MediaMeta = {
	alts: Record<string, string>;
	captions: Record<string, string>;
	focals: Record<string, { x: number; y: number }>;
	widths: Record<string, number>;
};

export type BootPayload = {
	user: { name: string; email: string } | null;
	sites: Site[];
	/** Aktif sitenin tarama sonucu (selectSite'nin ilk turunu besler). */
	scan?: { repo: string; scan: ScanResult };
	commits?: { repo: string; commits: CommitInfo[] };
	entries?: { repo: string; collection: string; rows: EntryRow[]; truncated: boolean };
	doc?: { repo: string; path: string; file: GitFile };
	contentmd?: { repo: string; text: string };
	media?: { repo: string; items: { path: string; size?: number }[]; meta: MediaMeta | null };
	reviews?: { repo: string; pulls: PullRequestRow[] };
};

let bootPayload: BootPayload | null = null;
const registry = new Map<string, unknown>();

/** Adanın ilk render'ından ÖNCE çağrılır; tohumları doldurur. */
export function seedBoot(boot: BootPayload): void {
	bootPayload = boot;
	if (boot.sites.length) queryClient.setQueryData(["projects"], boot.sites);
	if (boot.scan) registry.set(`scan:${boot.scan.repo}`, boot.scan.scan);
	if (boot.commits) registry.set(`commits:${boot.commits.repo}`, boot.commits.commits);
	if (boot.entries) {
		registry.set(`entries:${boot.entries.repo}|${boot.entries.collection}`, {
			rows: boot.entries.rows,
			truncated: boot.entries.truncated,
		});
	}
	if (boot.doc) registry.set(`doc:${boot.doc.repo}|${boot.doc.path}`, boot.doc.file);
	if (boot.contentmd) registry.set(`contentmd:${boot.contentmd.repo}`, boot.contentmd.text);
	if (boot.media) {
		registry.set(`media:${boot.media.repo}`, { items: boot.media.items, meta: boot.media.meta });
	}
	if (boot.reviews) {
		queryClient.setQueryData(["reviews", boot.reviews.repo], { pulls: boot.reviews.pulls });
	}
}

export function takeBoot(): BootPayload | null {
	return bootPayload;
}

/** Bir kez tüketilen prefetch okuması — ikinci çağrı normal ağ yoluna düşer. */
export function takePrefetch<T>(key: string): T | undefined {
	const hit = registry.get(key) as T | undefined;
	if (hit !== undefined) registry.delete(key);
	return hit;
}
