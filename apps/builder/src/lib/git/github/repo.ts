// GitHub repo okuma uçları — repo bilgisi ve token'ın eriştiği depolar.

import type { RepoInfo, RepoSummary } from "@wuppycms/shared";
import { BackendError } from "../backend";
import { gh, splitFullName } from "./api";

export async function getViewer(token: string): Promise<{ login: string; name?: string }> {
	const data = await gh<{ login: string; name?: string }>(token, "/user");
	return { login: data.login, name: data.name };
}

export async function createRepoFromTemplate(
	token: string,
	templateFullName: string,
	input: { owner: string; name: string; description?: string; private?: boolean },
): Promise<RepoInfo> {
	const { owner, repo } = splitFullName(templateFullName);
	const data = await gh<GhRepo>(token, `/repos/${owner}/${repo}/generate`, {
		method: "POST",
		body: JSON.stringify({
			owner: input.owner,
			name: input.name,
			description: input.description,
			private: Boolean(input.private),
			include_all_branches: false,
		}),
	});
	return {
		fullName: data.full_name,
		defaultBranch: data.default_branch,
		private: data.private,
		htmlUrl: data.html_url,
	};
}

type GhRepo = {
	full_name: string;
	default_branch: string;
	private: boolean;
	html_url: string;
};

export async function getRepo(token: string, fullName: string): Promise<RepoInfo> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhRepo>(token, `/repos/${owner}/${repo}`);
	return {
		fullName: data.full_name,
		defaultBranch: data.default_branch,
		private: data.private,
		htmlUrl: data.html_url,
	};
}

export async function enablePages(token: string, fullName: string): Promise<boolean> {
	const { owner, repo } = splitFullName(fullName);
	try {
		await gh(token, `/repos/${owner}/${repo}/pages`, {
			method: "POST",
			body: JSON.stringify({ build_type: "workflow" }),
		});
		return true;
	} catch (error) {
		if (error instanceof BackendError && error.status === 409) return true;
		return false;
	}
}

type GhRepoListItem = {
	full_name: string;
	private: boolean;
	default_branch: string;
	description: string | null;
	pushed_at: string;
	html_url: string;
};

/**
 * Token'ın erişebildiği depolar (sahip + işbirlikçi + örgüt üyeliği),
 * son itmeye göre azalan sırada. Sayfalar boyunca en fazla 500 depo döner.
 */
export async function listUserRepos(token: string): Promise<RepoSummary[]> {
	const repos: RepoSummary[] = [];
	for (let page = 1; page <= 5; page++) {
		const items = await gh<GhRepoListItem[]>(
			token,
			`/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member&page=${page}`,
		);
		for (const item of items) {
			repos.push({
				fullName: item.full_name,
				private: item.private,
				defaultBranch: item.default_branch,
				description: item.description,
				pushedAt: item.pushed_at,
				htmlUrl: item.html_url,
			});
		}
		if (items.length < 100) break;
	}
	return repos;
}
