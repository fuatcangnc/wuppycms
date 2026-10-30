// Node/AWS platformu: SQLite (EFS) + S3.
//
// `platformFromBindings` ile aynı arayüzü döndürür; API ve Astro sayfaları
// değişmeden çalışır.

import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import type { Platform } from "./index";
import { SQLiteDatabase } from "./sqlite";
import { createS3BlobStore } from "./s3";

export type NodePlatformOptions = {
	dbPath?: string;
	migrationsDir?: string;
	mediaBucket?: string;
	region?: string;
};

function runMigrations(db: Database.Database, dir: string): void {
	db.exec(
		"CREATE TABLE IF NOT EXISTS _wuppycms_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
	);
	if (!existsSync(dir)) return;
	const files = readdirSync(dir)
		.filter((file) => file.endsWith(".sql"))
		.sort();
	const applied = new Set(
		(db.prepare("SELECT name FROM _wuppycms_migrations").all() as { name: string }[]).map(
			(row) => row.name,
		),
	);
	// D1'den taşınan mevcut şema: migration tablosu boş ama çekirdek tablolar var.
	// Bu durumda migration'ları yeniden çalıştırmak "duplicate column" hatası verir.
	const hasCore = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
		.get();
	if (applied.size === 0 && hasCore) {
		const insert = db.prepare(
			"INSERT OR IGNORE INTO _wuppycms_migrations (name, applied_at) VALUES (?, ?)",
		);
		const tx = db.transaction(() => {
			for (const file of files) insert.run(file, new Date().toISOString());
		});
		tx();
		console.log("[db] mevcut şema algılandı; migration'lar uygulanmış sayıldı");
		return;
	}
	for (const file of files) {
		if (applied.has(file)) continue;
		const sql = readFileSync(join(dir, file), "utf8");
		const tx = db.transaction(() => {
			db.exec(sql);
			db.prepare("INSERT INTO _wuppycms_migrations (name, applied_at) VALUES (?, ?)").run(
				file,
				new Date().toISOString(),
			);
		});
		tx();
		console.log(`[db] migration ${file}`);
	}
}

export function createNodePlatform(options: NodePlatformOptions = {}): Platform {
	const dbPath = options.dbPath ?? process.env.DB_PATH ?? "/mnt/data/wuppycms.db";
	mkdirSync(dirname(dbPath), { recursive: true });
	const db = new Database(dbPath);
	db.pragma("journal_mode = WAL");
	db.pragma("busy_timeout = 5000");
	db.pragma("foreign_keys = ON");
	runMigrations(db, options.migrationsDir ?? process.env.MIGRATIONS_DIR ?? "./db/migrations");

	const platform: Platform = { db: new SQLiteDatabase(db) };
	(platform as Platform & { raw?: Database.Database }).raw = db;
	const bucket = options.mediaBucket ?? process.env.MEDIA_BUCKET;
	if (bucket) {
		platform.blobs = createS3BlobStore({
			bucket,
			region: options.region ?? process.env.AWS_REGION ?? "us-east-1",
		});
	}
	return platform;
}
