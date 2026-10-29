// Backend sözleşmesi testleri — scope sarmalayıcı + kayıt defteri/facade.

import { describe, expect, it } from "vitest";
import { scopeBackendService, type BackendService } from "./backend";
import { backends, getBackend, getRepo, listTree, selectBackend } from "./index";

/** Çağrıları kaydeden sahte sağlayıcı. */
function fakeService() {
	const calls: { method: string; args: unknown[] }[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test sahtesi: dönüş tipi serbest
	const record =
		(method: string) =>
		async (...args: unknown[]): Promise<any> => {
			calls.push({ method, args });
			return undefined;
		};

	const service: BackendService = {
		name: "github",
		label: "GitHub",
		isGit: true,
		getRepo: async (token, fullName) => {
			calls.push({ method: "getRepo", args: [token, fullName] });
			return { fullName, defaultBranch: "main", private: true, htmlUrl: "" };
		},
		listUserRepos: record("listUserRepos"),
		getBranch: record("getBranch"),
		listBranches: record("listBranches"),
		listTree: async (token, fullName, ref, recursive) => {
			calls.push({ method: "listTree", args: [token, fullName, ref, recursive] });
			return {
				entries: [
					{ path: "public/test/a.webp", type: "blob", sha: "s1", size: 4 },
					{ path: "README.md", type: "blob", sha: "s2", size: 1 },
				],
				truncated: false,
			};
		},
		getFile: async (token, fullName, path, ref) => {
			calls.push({ method: "getFile", args: [token, fullName, path, ref] });
			return { path, sha: "s", content: "x" };
		},
		getBlobBase64: record("getBlobBase64"),
		compareCommits: record("compareCommits"),
		listCommits: record("listCommits"),
		commitFiles: async (token, fullName, branch, files, message) => {
			calls.push({ method: "commitFiles", args: [token, fullName, branch, files, message] });
			return {
				sha: "c1",
				branch,
				message,
				files: files.map((f) => f.path),
				url: "",
			};
		},
	};
	return { service, calls };
}

describe("scopeBackendService", () => {
	it("kök boşsa servisi aynen döndürür", () => {
		const { service } = fakeService();
		expect(scopeBackendService(service, "/")).toBe(service);
	});

	it("ağaç yollarından kökü soyar", async () => {
		const { service } = fakeService();
		const scoped = scopeBackendService(service, "public");
		const { entries } = await scoped.listTree("t", "o/r", "main");
		expect(entries.map((e) => e.path)).toEqual(["test/a.webp", "README.md"]);
	});

	it("dosya okumada kökü ekler, dönen yolu soyar", async () => {
		const { service, calls } = fakeService();
		const scoped = scopeBackendService(service, "public");
		const file = await scoped.getFile("t", "o/r", "test/a.webp", "main");
		expect(calls[0].args[2]).toBe("public/test/a.webp");
		expect(file.path).toBe("test/a.webp");
	});

	it("commit'te girdi yollarına kökü ekler, sonuç yollarından soyar", async () => {
		const { service, calls } = fakeService();
		const scoped = scopeBackendService(service, "public");
		const result = await scoped.commitFiles(
			"t",
			"o/r",
			"main",
			[{ path: "test/a.webp", content: "x" }],
			"cms: deneme (via WuppyCMS)",
		);
		const files = calls[0].args[3] as { path: string }[];
		expect(files[0].path).toBe("public/test/a.webp");
		expect(result?.files).toEqual(["test/a.webp"]);
	});

	it("kök dışı yolları soymaz", async () => {
		const { service } = fakeService();
		const scoped = scopeBackendService(service, "site-a");
		const { entries } = await scoped.listTree("t", "o/r", "main");
		expect(entries[1].path).toBe("README.md");
	});
});

describe("kayıt defteri ve facade", () => {
	it("github kayıtlı ve etkin", () => {
		expect(backends.github.name).toBe("github");
		expect(getBackend()).toBe(backends.github);
		expect(getBackend("github")).toBe(backends.github);
	});

	it("facade etkin sağlayıcıya delege eder (sahte ile)", async () => {
		const original = backends.github;
		const { service, calls } = fakeService();
		backends.github = service; // facade her çağrıda getBackend() okur
		try {
			selectBackend("github");
			const repo = await getRepo("token", "owner/repo");
			expect(repo.fullName).toBe("owner/repo");
			const { entries } = await listTree("token", "owner/repo", "main");
			expect(entries.map((e) => e.path)).toContain("public/test/a.webp");
			expect(calls.map((c) => c.method)).toEqual(["getRepo", "listTree"]);
		} finally {
			backends.github = original;
		}
	});
});
