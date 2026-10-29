#!/usr/bin/env node
/**
 * WuppyCMS brand check.
 *
 * The product, packages, repository metadata, local storage, bridge protocol,
 * environment variables, preview and test accounts all use WuppyCMS. Historical
 * ADRs 0001–0009 are the only place where the old brand is allowed to remain.
 *
 * Run from the repository root with `pnpm check:brand`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", ".astro", "graphify-out", "evidence", ".wrangler"]);
const EXCLUDED_FILES = new Set(["scripts/check-brand.mjs"]);
const TEXT_EXT = /\.(tsx?|jsx?|mjs|astro|mdx?|css|json|jsonc|ya?ml|sql|txt|html|md)$/i;
const HISTORICAL_ADR = /^docs\/adr\/000[1-9]-/;

function walk(path, files = []) {
	const stat = statSync(path);
	if (stat.isDirectory()) {
		for (const name of readdirSync(path)) {
			if (EXCLUDED_DIRS.has(name)) continue;
			walk(join(path, name), files);
		}
	} else if (TEXT_EXT.test(path)) {
		files.push(path);
	}
	return files;
}

const files = walk(ROOT).filter((file) => {
	const rel = relative(ROOT, file).replaceAll("\\", "/");
	if (EXCLUDED_FILES.has(rel) || HISTORICAL_ADR.test(rel)) return false;
	return true;
});

const failures = [];
for (const file of files) {
	const rel = relative(ROOT, file).replaceAll("\\", "/");
	const lines = readFileSync(file, "utf8").split(/\r?\n/);
	lines.forEach((line, index) => {
		if (/reeyai|reeycms/i.test(line)) failures.push(`${rel}:${index + 1}: ${line.trim()}`);
	});
}

if (failures.length > 0) {
	console.error("Brand check failed — WuppyCMS dışında eski marka metni bulundu:\n");
	for (const failure of failures) console.error(`  ${failure}`);
	console.error("\nTüm adlar WuppyCMS olmalı. Tarihsel ADR 0001–0009 hariçtir.");
	process.exit(1);
}

console.log(`Brand check passed (${files.length} files, ${failures.length} issues).`);
