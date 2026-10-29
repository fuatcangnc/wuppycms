// Platform arayüzü uyumluluk testleri (ADR 0006) — referans adaptör (Cloudflare
// D1/R2) arayüzleri yapısal olarak karşılamalı; bellek-içi sahte adaptörle de
// çekirdek bir akış (projectRole) sürülebilmeli.

import { describe, expect, expectTypeOf, it } from "vitest";
import { projectRole } from "@/api/team";
import type { BlobStore, SqlDatabase, SqlStatement } from "./index";

// --- yapısal uyum: Cloudflare tipleri arayüzleri karşılar ----------------------

describe("referans adaptör (Cloudflare) uyumu", () => {
	it("D1Database, SqlDatabase arayüzünü karşılar", () => {
		expectTypeOf<D1Database>().toMatchTypeOf<SqlDatabase>();
	});

	it("R2Bucket, BlobStore arayüzünü karşılar", () => {
		expectTypeOf<R2Bucket>().toMatchTypeOf<BlobStore>();
	});
});

// --- bellek-içi sahte adaptör: çekirdek akış arayüzle sürülebilir --------------

type Row = Record<string, unknown>;

/** Cevap tablosu: SQL parçası → satır(lar). Yalnız test amaçlı, bilinçli dar. */
function memoryDatabase(responder: (sql: string) => Row | Row[] | null): SqlDatabase {
	const statement = (sql: string): SqlStatement => {
		const answer = () => {
			const result = responder(sql);
			return result ?? null;
		};
		const stmt: SqlStatement = {
			bind: () => stmt,
			first: async <T>() => (Array.isArray(answer()) ? ((answer() as Row[])[0] as T) : (answer() as T | null)),
			all: async <T>() => ({ results: (Array.isArray(answer()) ? (answer() as T[]) : answer() ? [answer() as T] : []) }),
			run: async () => ({}),
		};
		return stmt;
	};
	return { prepare: statement, batch: async (statements) => Promise.all(statements.map((s) => s.run())) };
}

describe("bellek-içi adaptörle çekirdek akış", () => {
	it("projectRole sahip/üye/yok kararlarını arayüz üzerinden verir", async () => {
		const ownerDb = memoryDatabase((sql) =>
			sql.includes("FROM projects") ? { id: "p1" } : null,
		);
		await expect(projectRole(ownerDb, "u1", "p1")).resolves.toBe("owner");

		const memberDb = memoryDatabase((sql) => {
			if (sql.includes("FROM projects")) return null;
			if (sql.includes("FROM project_members")) return { role: "viewer" };
			return null;
		});
		await expect(projectRole(memberDb, "u2", "p1")).resolves.toBe("viewer");

		const noneDb = memoryDatabase(() => null);
		await expect(projectRole(noneDb, "u3", "p1")).resolves.toBeNull();
	});
});
