// GitHub ağaç (tree) okuma ucu.

import type { TreeEntry } from "@wuppycms/shared";
import { gh, splitFullName } from "./api";

type GhTree = { tree: TreeEntry[]; truncated: boolean };

/** Ağacı listeler. `ref` dal adı, etiket ya da commit sha olabilir. */
export async function listTree(
	token: string,
	fullName: string,
	ref: string,
	recursive = true,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
	const { owner, repo } = splitFullName(fullName);
	const query = recursive ? "?recursive=1" : "";
	const data = await gh<GhTree>(
		token,
		`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}${query}`,
	);
	return {
		entries: data.tree.map((e) => ({
			path: e.path,
			type: e.type,
			sha: e.sha,
			size: e.size,
		})),
		truncated: data.truncated,
	};
}
