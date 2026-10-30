// src/lib/platform/aws-node.ts
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

// src/lib/platform/sqlite.ts
function toSqliteValue(value) {
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer);
  return value;
}
var SQLiteStatement = class _SQLiteStatement {
  constructor(db, sql, values = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }
  db;
  sql;
  values;
  bind(...values) {
    return new _SQLiteStatement(this.db, this.sql, values);
  }
  async first() {
    const row = this.db.prepare(this.sql).get(...this.values.map(toSqliteValue));
    return row ?? null;
  }
  async all() {
    const rows = this.db.prepare(this.sql).all(...this.values.map(toSqliteValue));
    return { results: rows };
  }
  async run() {
    return this.db.prepare(this.sql).run(...this.values.map(toSqliteValue));
  }
};
var SQLiteDatabase = class {
  constructor(db) {
    this.db = db;
  }
  db;
  prepare(sql) {
    return new SQLiteStatement(this.db, sql);
  }
  async batch(statements) {
    const tx = this.db.transaction(() => {
      for (const statement of statements) {
        void statement.run();
      }
    });
    return [tx()];
  }
};

// src/lib/platform/s3.ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
function createS3BlobStore(options) {
  const client = new S3Client({ region: options.region ?? "us-east-1" });
  const prefix = options.prefix ?? "";
  const key = (name) => `${prefix}${name}`;
  return {
    async get(name) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: key(name) })
        );
        if (!result.Body) return null;
        return {
          body: result.Body.transformToWebStream(),
          httpMetadata: { contentType: result.ContentType }
        };
      } catch (error) {
        const status = error?.$metadata?.httpStatusCode;
        const name_ = error?.name;
        if (status === 404 || name_ === "NoSuchKey") return null;
        throw error;
      }
    },
    async put(name, value, opts) {
      return client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: key(name),
          Body: value,
          ContentType: opts?.httpMetadata?.contentType
        })
      );
    },
    async delete(name) {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key(name) }));
    },
    async list(opts) {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: options.bucket,
          Prefix: key(opts.prefix ?? ""),
          MaxKeys: opts.limit ?? 1e3,
          ContinuationToken: opts.cursor
        })
      );
      return {
        objects: (result.Contents ?? []).map((item) => ({
          key: (item.Key ?? "").slice(prefix.length),
          size: item.Size ?? 0,
          uploaded: item.LastModified ?? /* @__PURE__ */ new Date()
        })),
        truncated: Boolean(result.IsTruncated),
        cursor: result.NextContinuationToken
      };
    }
  };
}

// src/lib/platform/aws-node.ts
function runMigrations(db, dir) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _wuppycms_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const applied = new Set(
    db.prepare("SELECT name FROM _wuppycms_migrations").all().map(
      (row) => row.name
    )
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _wuppycms_migrations (name, applied_at) VALUES (?, ?)").run(
        file,
        (/* @__PURE__ */ new Date()).toISOString()
      );
    });
    tx();
    console.log(`[db] migration ${file}`);
  }
}
function createNodePlatform(options = {}) {
  const dbPath = options.dbPath ?? process.env.DB_PATH ?? "/mnt/data/wuppycms.db";
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  runMigrations(db, options.migrationsDir ?? process.env.MIGRATIONS_DIR ?? "./db/migrations");
  const platform = { db: new SQLiteDatabase(db) };
  platform.raw = db;
  const bucket = options.mediaBucket ?? process.env.MEDIA_BUCKET;
  if (bucket) {
    platform.blobs = createS3BlobStore({
      bucket,
      region: options.region ?? process.env.AWS_REGION ?? "us-east-1"
    });
  }
  return platform;
}
export {
  createNodePlatform
};
