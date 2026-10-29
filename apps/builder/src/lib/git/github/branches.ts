// GitHub dal okuma uçları.

import type { BranchInfo } from "@wuppycms/shared";
import { gh, splitFullName } from "./api";

type GhBranch = { name: string; commit: { sha: string } };

export async function getBranch(
	token: string,
	fullName: string,
	branch: string,
): Promise<BranchInfo> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhBranch>(
		token,
		`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
	);
	return { name: data.name, sha: data.commit.sha };
}

export async function listBranches(token: string, fullName: string): Promise<BranchInfo[]> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhBranch[]>(token, `/repos/${owner}/${repo}/branches?per_page=100`);
	return data.map((b) => ({ name: b.name, sha: b.commit.sha }));
}
