// Sahte GitHub API'si — ağsız E2E için bellek-içi depo. Sveltia'nın
// MockGitHub deseninin bizdeki karşılığı: sıfır bağımlılık, tek dosya.
//
// Kapsam: uygulamanın kullandığı tüm uçlar — repo/branş/ağaç/blob/contents/
// commit geçmişi/compare + Git Data yazma yolu (blobs → trees → commits → ref).
// Kimlik: `Authorization: Bearer <token>` zorunlu (yanlışı 401).
// Kontrol (state okuma, seed, silme) HTTP'den değil, dönen nesnenin
// fonksiyonlarından yapılır — harness aynı süreçte çalışır.

import { createHash } from "node:crypto";
import { createServer } from "node:http";

const sha1 = (data) => createHash("sha1").update(data).digest("hex");

function json(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
	res.end(text);
}

/**
 * @param {object} [options]
 * @param {string} [options.fullName] "owner/repo"
 * @param {string} [options.branch]   Varsayılan dal adı
 * @param {string} [options.token]    Beklenen Bearer token
 */
export function createMockGitHub({ fullName = "mock/site", branch = "main", token = "mock-token" } = {}) {
	const blobs = new Map(); // sha → Buffer
	const trees = new Map(); // sha → Map<path, blobSha> (düz dosya listesi)
	const commits = new Map(); // sha → { sha, tree, parents, message, date, changes: Map<path,status> }
	const commitOrder = []; // sha'lar, eskiden yeniye
	const refs = new Map([[branch, null]]);
	// Pull request'ler (parity: inceleme akışı) — number → PR.
	const pulls = new Map();
	const reviews = new Map(); // number → [{ state, body, user, submitted_at }]
	let nextPrNumber = 1;

	// --- git nesne modeli -------------------------------------------------------

	const blobShaOf = (buf) => sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]));

	function treeShaOf(map) {
		const entries = [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
		const body = entries.map(([p, s]) => `100644 blob ${s}\t${p}\n`).join("");
		return sha1(Buffer.concat([Buffer.from(`tree ${Buffer.byteLength(body)}\0`), Buffer.from(body)]));
	}

	function treeOf(ref) {
		if (!ref) return null;
		const sha = refs.get(ref) ?? (commits.has(ref) ? ref : null);
		if (!sha) return null;
		return trees.get(commits.get(sha).tree) ?? null;
	}

	function makeCommit({ message, files, parentSha = null }) {
		const parentTree = parentSha ? trees.get(commits.get(parentSha).tree) : new Map();
		const tree = new Map(parentTree);
		const changes = new Map();
		for (const f of files) {
			if (f.delete) {
				if (tree.has(f.path)) {
					tree.delete(f.path);
					changes.set(f.path, "removed");
				}
			} else {
				const sha = blobShaOf(f.content);
				blobs.set(sha, f.content);
				tree.set(f.path, sha);
				changes.set(f.path, parentTree.has(f.path) ? "modified" : "added");
			}
		}
		const treeHash = treeShaOf(tree);
		trees.set(treeHash, tree);
		const date = Date.now();
		const parents = parentSha ? [parentSha] : [];
		const body = [
			`tree ${treeHash}`,
			...parents.map((p) => `parent ${p}`),
			`author Mock <mock@example.com> ${Math.floor(date / 1000)} +0000`,
			"",
			message,
			"",
		].join("\n");
		const sha = sha1(Buffer.concat([Buffer.from(`commit ${Buffer.byteLength(body)}\0`), Buffer.from(body)]));
		commits.set(sha, { sha, tree: treeHash, parents, message, date: new Date(date).toISOString(), changes });
		commitOrder.push(sha);
		refs.set(branch, sha);
		return commits.get(sha);
	}

	const blobFor = (tree, path) => (tree?.has(path) ? blobs.get(tree.get(path)) : null);

	function dirEntries(tree, path) {
		const prefix = path ? `${path}/` : "";
		const items = new Map();
		for (const p of tree.keys()) {
			if (!p.startsWith(prefix)) continue;
			const rest = p.slice(prefix.length);
			const slash = rest.indexOf("/");
			if (slash === -1) items.set(rest, { type: "file", path: p, sha: tree.get(p), size: blobs.get(tree.get(p))?.length ?? 0 });
			else {
				const dir = rest.slice(0, slash);
				items.set(dir, { type: "dir", path: `${prefix}${dir}`, sha: sha1(`dir:${prefix}${dir}`), size: 0 });
			}
		}
		return [...items.values()];
	}

	function treeEntries(tree, recursive) {
		if (!recursive) return dirEntries(tree, "");
		const dirs = new Set();
		const out = [];
		for (const [p, sha] of [...tree.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
			const parts = p.split("/");
			for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join("/"));
			out.push({ path: p, mode: "100644", type: "blob", sha, size: blobs.get(sha)?.length ?? 0 });
		}
		for (const d of [...dirs].sort()) out.push({ path: d, mode: "040000", type: "tree", sha: sha1(`dir:${d}`), size: 0 });
		return out;
	}

	function diffTrees(baseTree, headTree) {
		const files = [];
		const paths = new Set([...baseTree.keys(), ...headTree.keys()]);
		for (const p of paths) {
			const a = baseTree.get(p);
			const b = headTree.get(p);
			if (a === b) continue;
			const status = a === undefined ? "added" : b === undefined ? "removed" : "modified";
			const linesA = a === undefined ? 0 : (blobs.get(a)?.toString("utf8").split("\n").length ?? 0);
			const linesB = b === undefined ? 0 : (blobs.get(b)?.toString("utf8").split("\n").length ?? 0);
			const additions = status === "removed" ? 0 : linesB;
			const deletions = status === "added" ? 0 : linesA;
			files.push({ filename: p, status, additions, deletions, changes: additions + deletions });
		}
		return files;
	}

	function distance(base, head) {
		let n = 0;
		let cur = head;
		while (cur && cur !== base && n < 10_000) {
			cur = commits.get(cur)?.parents[0];
			n += 1;
		}
		return cur === base ? n : 0;
	}

	// --- HTTP ---------------------------------------------------------------------

	const server = createServer((req, res) => {
		const url = new URL(req.url, "http://127.0.0.1");
		const path = decodeURIComponent(url.pathname);
		const query = url.searchParams;
		const method = req.method ?? "GET";

		const readBody = () =>
			new Promise((resolve) => {
				const chunks = [];
				req.on("data", (c) => chunks.push(c));
				req.on("end", () => {
					try {
						resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
					} catch {
						resolve({});
					}
				});
			});

		const run = async () => {
			// Sahte AI sağlayıcısı (P5 E2E): OpenAI-uyumlu chat completions —
			// son kullanıcı mesajını yankılar; üretim akışı ağsız sınanır.
			if (path === "/v1/chat/completions" && method === "POST") {
				const body = await readBody();
				const messages = body.messages ?? [];
				const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
				const system = messages.find((m) => m.role === "system")?.content ?? "";

				// Ajan (ADR 0008) streaming + tool-call bekler. Deterministik mock:
				//  - "LIST"  → get_site_info aracı, sonra metin
				//  - "WRITE" → content_update aracı, sonra metin
				//  - aksi    → düz metin
				if (body.stream) {
					const hasToolResult = messages.some((m) => m.role === "tool");
					res.writeHead(200, {
						"content-type": "text/event-stream",
						"cache-control": "no-cache",
						connection: "keep-alive",
					});
					const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
					if (!hasToolResult) {
						const tool = /WRITE/i.test(lastUser)
							? {
									name: "content_update",
									args: JSON.stringify({
										collection: "blog",
										id: "merhaba-dunya",
										data: { title: "Mock agent başlığı" },
									}),
								}
							: /LIST/i.test(lastUser)
								? { name: "get_site_info", args: "{}" }
								: null;
						if (tool) {
							send({
								id: "mock-completion",
								choices: [
									{
										index: 0,
										delta: {
											tool_calls: [
												{
													index: 0,
													id: "call_mock_1",
													type: "function",
													function: { name: tool.name, arguments: tool.args },
												},
											],
										},
									},
								],
							});
							send({ id: "mock-completion", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });
						} else {
							for (const chunk of ["Mock ", "agent ", "yanıtı."]) {
								send({ id: "mock-completion", choices: [{ index: 0, delta: { content: chunk } }] });
							}
							send({ id: "mock-completion", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
						}
					} else {
						for (const chunk of ["İşlem ", "tamam. ", "Mock agent."]) {
							send({ id: "mock-completion", choices: [{ index: 0, delta: { content: chunk } }] });
						}
						send({ id: "mock-completion", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
					}
					res.write("data: [DONE]\n\n");
					res.end();
					return;
				}

				return json(res, 200, {
					id: "mock-completion",
					choices: [
						{
							message: {
								role: "assistant",
								content: `ÜRETİLDİ:\n${lastUser}\n\nSistem kuralı: ${system.split("\n")[1] ?? ""}`,
							},
						},
					],
					model: body.model ?? "mock-model",
				});
			}

			if (path === "/user" || path.startsWith("/user/") || path.startsWith("/repos/")) {
				if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { message: "Bad credentials" });
			}

			// Kullanıcı uçları repo yolundan ÖNCE gelir: `/user/repos` aksi hâlde
			// `/repos/:owner/:repo` kalıbına takılıp 404 dönerdi.
			if (path === "/user" && method === "GET") {
				return json(res, 200, { login: fullName.split("/")[0], name: "Mock" });
			}
			if (path === "/user/repos" && method === "GET") {
				const headSha = refs.get(branch);
				return json(res, 200, [
					{
						full_name: fullName,
						private: true,
						default_branch: branch,
						description: "WuppyCMS E2E mock deposu",
						pushed_at: (headSha && commits.get(headSha)?.date) || new Date().toISOString(),
						html_url: `https://github.com/${fullName}`,
					},
				]);
			}

			const repoMatch = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(path);
			if (!repoMatch) return json(res, 404, { message: "Not Found" });
			const [, owner, repo, rest = ""] = repoMatch;
			if (`${owner}/${repo}` !== fullName) return json(res, 404, { message: "Not Found" });
			const head = refs.get(branch);

			// --- okuma uçları ---
			if (rest === "" && method === "GET") {
				return json(res, 200, {
					full_name: fullName,
					default_branch: branch,
					private: true,
					html_url: `https://github.com/${fullName}`,
				});
			}
			if (rest === "/branches" && method === "GET") {
				return json(res, 200, [...refs.entries()].filter(([, sha]) => sha).map(([name, sha]) => ({ name, commit: { sha } })));
			}
			if (rest.startsWith("/branches/") && method === "GET") {
				const name = rest.slice("/branches/".length);
				const sha = refs.get(name);
				if (!sha) return json(res, 404, { message: "Branch not found" });
				return json(res, 200, { name, commit: { sha } });
			}
			if (rest.startsWith("/git/trees/") && method === "GET") {
				const ref = rest.slice("/git/trees/".length);
				const tree = treeOf(ref);
				if (!tree) return json(res, 404, { message: "Not Found" });
				return json(res, 200, { sha: ref, tree: treeEntries(tree, query.get("recursive") === "1"), truncated: false });
			}
			if (rest.startsWith("/git/blobs/") && method === "GET") {
				const sha = rest.slice("/git/blobs/".length);
				const buf = blobs.get(sha);
				if (!buf) return json(res, 404, { message: "Not Found" });
				return json(res, 200, {
					sha,
					size: buf.length,
					encoding: "base64",
					content: buf.toString("base64").replace(/(.{60})/g, "$1\n"),
				});
			}
			if (rest.startsWith("/git/ref/heads/") && method === "GET") {
				const name = rest.slice("/git/ref/heads/".length);
				const sha = refs.get(name);
				if (!sha) return json(res, 404, { message: "Not Found" });
				return json(res, 200, { ref: `refs/heads/${name}`, object: { sha, type: "commit" } });
			}
			if (rest.startsWith("/git/commits/") && method === "GET") {
				const c = commits.get(rest.slice("/git/commits/".length));
				if (!c) return json(res, 404, { message: "Not Found" });
				return json(res, 200, { sha: c.sha, message: c.message, tree: { sha: c.tree }, parents: c.parents.map((s) => ({ sha: s })) });
			}
			if (rest.startsWith("/contents") && method === "GET") {
				const filePath = rest.slice("/contents/".length);
				const tree = treeOf(query.get("ref") || branch);
				if (!tree) return json(res, 404, { message: "Not Found" });
				if (tree.has(filePath)) {
					const sha = tree.get(filePath);
					const buf = blobs.get(sha);
					return json(res, 200, {
						type: "file",
						path: filePath,
						sha,
						size: buf.length,
						encoding: "base64",
						content: buf.toString("base64").replace(/(.{60})/g, "$1\n"),
					});
				}
				const items = dirEntries(tree, filePath);
				if (items.length === 0) return json(res, 404, { message: "Not Found" });
				return json(res, 200, items.map((i) => ({ ...i, type: i.type === "dir" ? "dir" : "file" })));
			}
			if (rest === "/commits" && method === "GET") {
				const filterPath = query.get("path");
				const perPage = Number(query.get("per_page") ?? 30);
				const list = [...commitOrder]
					.reverse()
					.map((sha) => commits.get(sha))
					.filter((c) => !filterPath || [...c.changes.keys()].some((p) => p === filterPath || p.startsWith(`${filterPath}/`)))
					.slice(0, perPage)
					.map((c) => ({
						sha: c.sha,
						commit: { message: c.message, author: { name: "Mock", date: c.date } },
						author: { login: "mock" },
					}));
				return json(res, 200, list);
			}
			if (rest.startsWith("/compare/") && method === "GET") {
				const spec = rest.slice("/compare/".length);
				const [baseRef, headRef] = spec.split("...");
				const baseTree = treeOf(baseRef);
				const headTree = treeOf(headRef);
				if (!baseTree || !headTree) return json(res, 404, { message: "Not Found" });
				const baseSha = refs.get(baseRef) ?? baseRef;
				const headSha = refs.get(headRef) ?? headRef;
				return json(res, 200, { ahead_by: distance(baseSha, headSha), files: diffTrees(baseTree, headTree) });
			}

			// --- Git Data yazma yolu ---
			if (rest === "/git/blobs" && method === "POST") {
				const body = await readBody();
				const buf = body.encoding === "base64" ? Buffer.from(body.content ?? "", "base64") : Buffer.from(body.content ?? "", "utf8");
				const sha = blobShaOf(buf);
				blobs.set(sha, buf);
				return json(res, 201, { sha });
			}
			if (rest === "/git/trees" && method === "POST") {
				const body = await readBody();
				const map = new Map(trees.get(body.base_tree) ?? new Map());
				for (const entry of body.tree ?? []) {
					if (entry.sha === null) map.delete(entry.path);
					else map.set(entry.path, entry.sha);
				}
				const sha = treeShaOf(map);
				trees.set(sha, map);
				return json(res, 201, { sha });
			}
			if (rest === "/git/commits" && method === "POST") {
				const body = await readBody();
				if (!trees.has(body.tree)) return json(res, 422, { message: "Tree not found" });
				const treeHash = body.tree;
				const parents = body.parents ?? [];
				const date = Date.now();
				const text = [
					`tree ${treeHash}`,
					...parents.map((p) => `parent ${p}`),
					`author ${body.author?.name ?? "Mock"} <mock@example.com> ${Math.floor(date / 1000)} +0000`,
					"",
					body.message ?? "",
					"",
				].join("\n");
				const sha = sha1(Buffer.concat([Buffer.from(`commit ${Buffer.byteLength(text)}\0`), Buffer.from(text)]));
				const parentTree = parents[0] ? trees.get(commits.get(parents[0])?.tree) : new Map();
				const changes = new Map();
				const tree = trees.get(treeHash);
				for (const p of new Set([...(parentTree?.keys() ?? []), ...tree.keys()])) {
					const a = parentTree?.get(p);
					const b = tree.get(p);
					if (a !== b) changes.set(p, a === undefined ? "added" : b === undefined ? "removed" : "modified");
				}
				commits.set(sha, { sha, tree: treeHash, parents, message: body.message ?? "", date: new Date(date).toISOString(), changes });
				commitOrder.push(sha);
				return json(res, 201, { sha, tree: { sha: treeHash } });
			}
			if (rest.startsWith("/git/refs/heads/") && method === "PATCH") {
				const name = rest.slice("/git/refs/heads/".length);
				const body = await readBody();
				const current = refs.get(name);
				if (!refs.has(name)) return json(res, 404, { message: "Not Found" });
				if (!commits.has(body.sha)) return json(res, 422, { message: "Object does not exist" });
				if (!body.force && current && !commits.get(body.sha).parents.includes(current)) {
					return json(res, 422, { message: "Update is not a fast forward" });
				}
				refs.set(name, body.sha);
				return json(res, 200, { object: { sha: body.sha, type: "commit" } });
			}

			// --- dal oluşturma (inceleme akışı: review/<slug> dalları) ---
			if (rest === "/git/refs" && method === "POST") {
				const body = await readBody();
				const refName = String(body.ref ?? "").replace(/^refs\/heads\//, "");
				if (!refName || !body.sha) return json(res, 422, { message: "ref ve sha zorunlu" });
				if (refs.has(refName) && refs.get(refName)) return json(res, 422, { message: "Reference already exists" });
				refs.set(refName, body.sha);
				return json(res, 201, { ref: `refs/heads/${refName}`, object: { sha: body.sha, type: "commit" } });
			}

			// --- pull request'ler (inceleme akışı) ---
			if (rest === "/pulls" && method === "POST") {
				const body = await readBody();
				const head = String(body.head ?? "");
				const base = String(body.base ?? branch);
				if (!refs.has(head)) return json(res, 422, { message: `No commits between ${base} and ${head}` });
				const number = nextPrNumber++;
				const pr = {
					number,
					title: body.title ?? "",
					body: body.body ?? "",
					head,
					base,
					state: "open",
					merged: false,
					draft: Boolean(body.draft),
					user: { login: "mock" },
					created_at: new Date().toISOString(),
				};
				pulls.set(number, pr);
				reviews.set(number, []);
				return json(res, 201, pr);
			}
			if (rest === "/pulls" && method === "GET") {
				const state = query.get("state") ?? "open";
				const list = [...pulls.values()].filter((pr) => (state === "all" ? true : pr.state === state));
				return json(res, 200, list);
			}
			if (/^\/pulls\/\d+$/.test(rest)) {
				const number = Number(rest.split("/")[2]);
				const pr = pulls.get(number);
				if (!pr) return json(res, 404, { message: "Not Found" });
				if (method === "GET") return json(res, 200, { ...pr, head: { ref: pr.head }, base: { ref: pr.base } });
				if (method === "PATCH") {
					const body = await readBody();
					if (body.state) pr.state = body.state === "closed" ? "closed" : "open";
					return json(res, 200, pr);
				}
			}
			if (/^\/pulls\/\d+\/reviews$/.test(rest)) {
				const number = Number(rest.split("/")[2]);
				const pr = pulls.get(number);
				if (!pr) return json(res, 404, { message: "Not Found" });
				if (method === "GET") return json(res, 200, reviews.get(number) ?? []);
				if (method === "POST") {
					const body = await readBody();
					const review = {
						state: body.event === "APPROVE" ? "APPROVED" : body.event === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : "COMMENTED",
						body: body.body ?? "",
						user: { login: "mock" },
						submitted_at: new Date().toISOString(),
					};
					reviews.set(number, [...(reviews.get(number) ?? []), review]);
					return json(res, 200, review);
				}
			}
			if (/^\/pulls\/\d+\/merge$/.test(rest) && method === "PUT") {
				const number = Number(rest.split("/")[2]);
				const pr = pulls.get(number);
				if (!pr) return json(res, 404, { message: "Not Found" });
				if (pr.state !== "open") return json(res, 405, { message: "Pull Request is not mergeable" });
				// Basit birleştirme: dalın ağacını taban dalın ağacının üzerine bindir.
				const headTree = treeOf(pr.head);
				const baseTree = treeOf(pr.base);
				if (!headTree || !baseTree) return json(res, 409, { message: "Merge conflict" });
				const merged = new Map(baseTree);
				const changes = new Map();
				for (const [path, sha] of headTree.entries()) {
					if (merged.get(path) !== sha) {
						changes.set(path, merged.has(path) ? "modified" : "added");
						merged.set(path, sha);
					}
				}
				const date = Date.now();
				const treeHash = treeShaOf(merged);
				trees.set(treeHash, merged);
				const baseHead = refs.get(pr.base);
				const body = [`tree ${treeHash}`, `parent ${baseHead}`, `parent ${refs.get(pr.head)}`, "", `Merge pull request #${number}`, ""].join("\n");
				const sha = sha1(Buffer.concat([Buffer.from(`commit ${Buffer.byteLength(body)}\0`), Buffer.from(body)]));
				commits.set(sha, { sha, tree: treeHash, parents: [baseHead, refs.get(pr.head)], message: `Merge pull request #${number}`, date: new Date(date).toISOString(), changes });
				commitOrder.push(sha);
				refs.set(pr.base, sha);
				pr.state = "closed";
				pr.merged = true;
				pr.merged_at = new Date(date).toISOString();
				return json(res, 200, { merged: true, sha, message: "Pull Request successfully merged" });
			}

			// --- contents yazma (harness temizliği + GitHub uyumu) ---
			if (rest.startsWith("/contents/") && (method === "DELETE" || method === "PUT")) {
				const filePath = rest.slice("/contents/".length);
				const body = await readBody();
				const tree = treeOf(body.branch || branch);
				const existing = tree?.get(filePath);
				if (method === "DELETE") {
					if (!existing) return json(res, 404, { message: "Not Found" });
					if (body.sha && body.sha !== existing) return json(res, 409, { message: "SHA does not match" });
					const commit = makeCommit({ message: body.message ?? "", files: [{ path: filePath, delete: true }], parentSha: refs.get(branch) });
					return json(res, 200, { commit: { sha: commit.sha } });
				}
				if (existing && body.sha && body.sha !== existing) return json(res, 409, { message: "SHA does not match" });
				const buf = Buffer.from(body.content ?? "", "base64");
				const commit = makeCommit({ message: body.message ?? "", files: [{ path: filePath, content: buf }], parentSha: refs.get(branch) });
				return json(res, existing ? 200 : 201, { content: { path: filePath, sha: tree.get(filePath) ?? null }, commit: { sha: commit.sha } });
			}

			return json(res, 404, { message: "Not Found" });
		};

		run().catch((error) => json(res, 500, { message: String(error) }));
	});

	// --- dışa dönük API ------------------------------------------------------------

	return {
		/** 0 → rastgele boş port; dinlenen portu döndürür. */
		listen: (port = 0) =>
			new Promise((resolve) => {
				server.listen(port, "127.0.0.1", () => resolve(server.address().port));
			}),
		close: () => new Promise((resolve) => server.close(resolve)),

		head: () => refs.get(branch),
		files: () => {
			const tree = treeOf(branch);
			return tree ? [...tree.entries()].map(([path, sha]) => ({ path, sha, size: blobs.get(sha)?.length ?? 0 })) : [];
		},
		readFile: (path, ref) => blobFor(treeOf(ref ?? branch), path) ?? null,
		commits: () => [...commitOrder].reverse().map((sha) => commits.get(sha)),
		/** Bir yolun geçmişinde `needle` + "(via WuppyCMS)" içeren commit var mı? */
		commitsFor: (path, needle) =>
			[...commitOrder].reverse().some((sha) => {
				const c = commits.get(sha);
				if (!c.message.includes(needle) || !c.message.includes("via WuppyCMS")) return false;
				return [...c.changes.keys()].some((p) => p === path || p.startsWith(`${path}/`));
			}),
		/** Pull request yardımcıları (inceleme akışı testleri). */
		pulls: () => [...pulls.values()],
		pull: (number) => pulls.get(number) ?? null,
		reviews: (number) => reviews.get(number) ?? [],

		/** Harness temizliği: dosyayı commit'le siler; dosya yoksa false. */		deleteFile: (path, message = "chore: e2e temizlik (via WuppyCMS)") => {
			if (!treeOf(branch)?.has(path)) return false;
			makeCommit({ message, files: [{ path, delete: true }], parentSha: refs.get(branch) });
			return true;
		},
		/** Toplu commit (dosyalar: { path, content(Buffer) } veya { path, delete:true }). */
		commit: (files, message) => makeCommit({ message, files, parentSha: refs.get(branch) }).sha,
		/** İlk commit'i (seed) atar; repo boş olmalı. */
		seed: (files, message = "chore: e2e mock seed") =>
			makeCommit({ message, files: files.map((f) => ({ path: f.path, content: Buffer.from(f.content ?? f.contentBase64 ?? "", f.contentBase64 ? "base64" : "utf8") })), parentSha: null }).sha,
	};
}
