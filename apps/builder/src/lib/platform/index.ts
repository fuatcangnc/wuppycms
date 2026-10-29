// Platform adaptörleri (ADR 0006) — çekirdek bu arayüzleri tüketir; Cloudflare
// yığını (D1 + R2 + Cron) REFERANS adaptördür. Self-host hedefi: SQLite/dosya
// tabanlı eşdeğerler bu arayüzleri uygular; iş mantığı değişmez.
//
// Kapsam bilinçli olarak dar: yalnız çekirdeğin gerçekten kullandığı yüzey
// (SQL + blob + saat). Genişletme, ihtiyaç doğdukça burada yapılır.
//
// Göç durumu: docs/portability.md (kademeli — tüm `c.env.DB` çağrıları önce
// bu arayüz tipine bağlanır, sonra adaptör fabrikasına taşınır).

/** SQL bağlamasına girebilen değerler. */
export type SqlValue = string | number | null | ArrayBuffer;

/** Tek bir hazırlanmış SQL ifadesi (D1 `prepare` sonucuyla yapısal uyumlu). */
export interface SqlStatement {
	bind(...values: SqlValue[]): SqlStatement;
	first<T = unknown>(): Promise<T | null>;
	all<T = unknown>(): Promise<{ results: T[] }>;
	run(): Promise<unknown>;
}

/** SQL veritabanı yüzeyi — D1 bu arayüzü yapısal olarak karşılar. */
export interface SqlDatabase {
	prepare(sql: string): SqlStatement;
	batch(statements: SqlStatement[]): Promise<unknown[]>;
}

/** Blob nesnesi (R2 `get` sonucuyla yapısal uyumlu). */
export interface BlobObject {
	body: ReadableStream | ArrayBuffer | Uint8Array | null;
	httpMetadata?: { contentType?: string };
}

export interface BlobListEntry {
	key: string;
	size: number;
	uploaded: Date;
}

/** Blob deposu yüzeyi — R2 bu arayüzü yapısal olarak karşılar. */
export interface BlobStore {
	get(key: string): Promise<BlobObject | null>;
	put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
	delete(key: string): Promise<void>;
	list(options: { prefix?: string; limit?: number; cursor?: string }): Promise<{
		objects: BlobListEntry[];
		truncated: boolean;
		cursor?: string;
	}>;
}

/** Çekirdeğin platformdan beklediği her şey (opsiyonel alanlar: özellik kapalı). */
export interface Platform {
	/** Kimlik/proje/ekip/AI ayarları — içerik ASLA burada yaşamaz (ADR 0006). */
	db?: SqlDatabase;
	/** Medya kovaları (R2 ya da dosya sistemi). */
	blobs?: BlobStore;
}

/** Cloudflare bağlamalarından referans platformu üretir. */
export function platformFromBindings(bindings: {
	DB?: SqlDatabase;
	MEDIA_R2?: BlobStore;
}): Platform {
	return { db: bindings.DB, blobs: bindings.MEDIA_R2 };
}
