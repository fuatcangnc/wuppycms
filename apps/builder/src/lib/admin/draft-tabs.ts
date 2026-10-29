// Yerel taslak sekmeleri (Wryte "Main / + Draft" paritesi) — makale başına
// birden çok çalışma kopyası. Yalnız tarayıcıda (IndexedDB) yaşar; repo'ya
// yazılmaz (ADR 0006: repo tek gerçek kaynak). Aktif sekmenin içeriği editörde
// düzenlenir; "Kaydet" hangi sekme aktifse onun içeriğini commit'ler.

import { atom } from "nanostores";

export type DraftTab = {
	id: string;
	name: string;
	/** MDX gövdesi. */
	body: string;
	/** Form alanlarının görüntü değerleri (string sözlüğü). */
	values: Record<string, string>;
	createdAt: number;
	updatedAt: number;
};

/** Bir yerel taslak sekmesi aktif mi? DocView, taslak yedeği otomatiğini buna
 *  göre duraklatır — taslak içeriği kendi deposunda yaşar (çift kayıt olmaz). */
export const $draftTabActive = atom(false);

type StoredTabs = { key: string; tabs: DraftTab[] };

const DB_NAME = "wuppycms-draft-tabs";
const STORE = "tabs";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** IndexedDB'yi tembel açar; yoksa (SSR/kısıtlı ortam) null döner. */
function openDb(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined") return Promise.resolve(null);
	dbPromise ??= new Promise((resolve) => {
		try {
			const request = indexedDB.open(DB_NAME, VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE, { keyPath: "key" });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return dbPromise;
}

/** Tek kayıt üzerinde işlem yürütür; depo yoksa sessizce null döner. */
async function withStore<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
	const db = await openDb();
	if (!db) return null;
	return new Promise((resolve) => {
		try {
			const tx = db.transaction(STORE, mode);
			const request = run(tx.objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

const keyFor = (repo: string, path: string) => `${repo}:${path}`;

/** Dokümanın yerel taslak sekmelerini getirir (yoksa boş liste). */
export async function listDraftTabs(repo: string, path: string): Promise<DraftTab[]> {
	const stored = await withStore<StoredTabs | undefined>("readonly", (store) =>
		store.get(keyFor(repo, path)) as IDBRequest<StoredTabs | undefined>,
	);
	return stored?.tabs ?? [];
}

/** Sekme listesini yazar (aynı doküman için üzerine). */
export async function writeDraftTabs(repo: string, path: string, tabs: DraftTab[]): Promise<void> {
	await withStore("readwrite", (store) =>
		store.put({ key: keyFor(repo, path), tabs } as StoredTabs),
	);
}

/** Sıradaki boş taslak adı: "Taslak 1", "Taslak 2"… (çakışanları atlar). */
export function nextDraftName(existing: string[], prefix = "Taslak"): string {
	let n = 1;
	while (existing.includes(`${prefix} ${n}`)) n += 1;
	return `${prefix} ${n}`;
}

/** Oturum içi sıra — aynı milisaniyede üretilen kimliklerin de çakışmasını engeller. */
let draftIdSeq = 0;

/** Yeni sekme kimliği (çakışmasız: zaman + oturum sırası + rastgele ek). */
export function newDraftId(): string {
	draftIdSeq += 1;
	return `tab-${Date.now()}-${draftIdSeq.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
