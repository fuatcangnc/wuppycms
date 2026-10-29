// Kaydedilmemiş düzenlemelerin tarayıcı-içi yedeği (IndexedDB).
// Sveltia'nın `contents/draft/backup.js` deseni: sekme çökerse ya da sayfa
// yanlışlıkla yenilenirse içerik kaybolmaz; repo tek gerçek kaynak olarak
// kalır (ADR 0006 — yedek sunucuya gitmez, yalnız kurtarma içindir).
//
// Bu modül bilinçli olarak editörden bağımsız: yalnız gövde metni + alan
// sözlüğü taşır; P0 (mdxeditor) gelince aynen çalışmaya devam eder.

export type DraftBackup = {
	/** "owner/repo" — depo başına ayrı kayıt. */
	repo: string;
	/** Repo içi dosya yolu. */
	path: string;
	/** MDX gövdesi. */
	body: string;
	/** Form alanlarının görüntü değerleri (string sözlüğü). */
	values: Record<string, string>;
	/** Yedeğin alındığı andaki dosya sha'sı (çakışma tespiti için). */
	baseSha: string;
	savedAt: number;
};

type StoredBackup = DraftBackup & { key: string };

const DB_NAME = "wuppycms-drafts";
const STORE = "drafts";
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

/** Yolu verilen dokümanın yedeğini getirir (yoksa null). */
export async function loadDraftBackup(repo: string, path: string): Promise<DraftBackup | null> {
	const stored = await withStore<StoredBackup | undefined>("readonly", (store) =>
		store.get(keyFor(repo, path)) as IDBRequest<StoredBackup | undefined>,
	);
	return stored ?? null;
}

/** Yedeği yazar (aynı yol için üzerine). */
export async function saveDraftBackup(entry: DraftBackup): Promise<void> {
	await withStore("readwrite", (store) =>
		store.put({ ...entry, key: keyFor(entry.repo, entry.path) } as StoredBackup & { key: string }),
	);
}

/** Yedeği siler (kayıt, vazgeçme ya da yedek artık gereksizken). */
export async function clearDraftBackup(repo: string, path: string): Promise<void> {
	await withStore("readwrite", (store) => store.delete(keyFor(repo, path)));
}
