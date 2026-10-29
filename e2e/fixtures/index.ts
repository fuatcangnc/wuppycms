/**
 * Test fixture'ları — EmDash `e2e/fixtures/index.ts` deseninin uyarlaması.
 * Sunucu global-setup'ta başlar; burada yalnız `admin` ve `serverInfo` verilir.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test as base } from "@playwright/test";

import { AdminPage, type ServerInfo } from "./admin";

export { AdminPage } from "./admin";
export type { ServerInfo } from "./admin";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_INFO_PATH = resolve(HERE, "../../.e2e/server-info.json");

function getServerInfo(): ServerInfo {
	return JSON.parse(readFileSync(SERVER_INFO_PATH, "utf-8")) as ServerInfo;
}

export const test = base.extend<{
	admin: AdminPage;
	serverInfo: ServerInfo;
}>({
	// eslint-disable-next-line no-empty-pattern
	serverInfo: async ({}, use) => {
		await use(getServerInfo());
	},
	admin: async ({ page }, use) => {
		const admin = new AdminPage(page);
		await use(admin);
	},
});

export { expect } from "@playwright/test";
