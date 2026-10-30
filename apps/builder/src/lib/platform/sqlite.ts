// SQLite (better-sqlite3) üzerinde D1 uyumlu SqlDatabase adaptörü.
// D1 zaten SQLite olduğu için sorgular değişmez; yalnız API yüzeyi eşlenir.

import type Database from "better-sqlite3";
import type { SqlDatabase, SqlStatement, SqlValue } from "./index";

function toSqliteValue(value: SqlValue): unknown {
	if (value instanceof ArrayBuffer) return Buffer.from(value);
	if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer);
	return value;
}

class SQLiteStatement implements SqlStatement {
	constructor(
		private readonly db: Database.Database,
		private readonly sql: string,
		private readonly values: SqlValue[] = [],
	) {}

	bind(...values: SqlValue[]): SqlStatement {
		return new SQLiteStatement(this.db, this.sql, values);
	}

	async first<T = unknown>(): Promise<T | null> {
		const row = this.db
			.prepare(this.sql)
			.get(...this.values.map(toSqliteValue)) as T | undefined;
		return row ?? null;
	}

	async all<T = unknown>(): Promise<{ results: T[] }> {
		const rows = this.db
			.prepare(this.sql)
			.all(...this.values.map(toSqliteValue)) as T[];
		return { results: rows };
	}

	async run(): Promise<unknown> {
		return this.db.prepare(this.sql).run(...this.values.map(toSqliteValue));
	}
}

export class SQLiteDatabase implements SqlDatabase {
	constructor(private readonly db: Database.Database) {}

	prepare(sql: string): SqlStatement {
		return new SQLiteStatement(this.db, sql);
	}

	async batch(statements: SqlStatement[]): Promise<unknown[]> {
		const tx = this.db.transaction(() => {
			for (const statement of statements) {
				// SQLiteStatement.run senkron çalışır; promise'i beklemeden geç.
				void (statement as SQLiteStatement).run();
			}
		});
		return [tx()];
	}
}
