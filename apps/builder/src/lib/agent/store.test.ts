import { describe, expect, it } from "vitest";
import type { SqlDatabase } from "../platform";
import { loadMessages, removeChangeIdFromMessages } from "./store";

type QueryResult = { results: Record<string, unknown>[] };

function fakeDb(handler: (sql: string, args: unknown[]) => QueryResult | Promise<QueryResult>) {
	const updates: { sql: string; args: unknown[] }[] = [];
	const db = {
		prepare(sql: string) {
			return {
				bind(...args: unknown[]) {
					return {
						async all() {
							return handler(sql, args);
						},
						async run() {
							updates.push({ sql, args });
							return { success: true };
						},
						async first() {
							const result = await handler(sql, args);
							return result.results[0] ?? null;
						},
					};
				},
			};
		},
	} as unknown as SqlDatabase;
	return { db, updates };
}

describe("agent store undo görünürlüğü", () => {
	it("geri alınmış change_ids mesajdan filtrelenir", async () => {
		const { db } = fakeDb((sql) => {
			if (sql.includes("FROM agent_messages")) {
				return {
					results: [
						{
							role: "user",
							text: "sonuna CMS ekle",
							ts: "2026-10-29T00:00:00.000Z",
							tool_name: null,
							change_ids: JSON.stringify(["chg_live", "chg_gone"]),
						},
					],
				};
			}
			return { results: [{ id: "chg_gone" }] };
		});

		const messages = await loadMessages(db, "ses_test");
		expect(messages[0]?.changeIds).toEqual(["chg_live"]);
	});

	it("undo sonrası mesaj kaydındaki change id temizlenir", async () => {
		const { db, updates } = fakeDb((sql) => {
			if (sql.includes("SELECT id, change_ids FROM agent_messages")) {
				return {
					results: [
						{ id: "msg_1", change_ids: JSON.stringify(["chg_gone", "chg_other"]) },
					],
				};
			}
			return { results: [] };
		});

		await removeChangeIdFromMessages(db, "chg_gone");
		expect(updates.at(-1)?.sql).toContain("UPDATE agent_messages SET change_ids");
		expect(updates.at(-1)?.args[0]).toBe(JSON.stringify(["chg_other"]));
	});
});
