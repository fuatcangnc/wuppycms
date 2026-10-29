// GitHub commit geçmişi uçları — karşılaştırma ve dal/dosya bazlı geçmiş.

import type { CommitInfo, CompareFile } from "@wuppycms/shared";
import { gh, splitFullName } from "./api";

type GhCompare = {
	ahead_by: number;
	files?: {
		filename: string;
		status: CompareFile["status"];
		additions: number;
		deletions: number;
		changes: number;
	}[];
};

/** İki revizyon arasındaki değişen dosyalar (inceleme/diff görünümü). */
export async function compareCommits(
	token: string,
	fullName: string,
	base: string,
	head: string,
): Promise<{ aheadBy: number; files: CompareFile[] }> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhCompare>(
		token,
		`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
	);
	return {
		aheadBy: data.ahead_by,
		files: (data.files ?? []).map((f) => ({
			filename: f.filename,
			status: f.status,
			additions: f.additions,
			deletions: f.deletions,
			changes: f.changes,
		})),
	};
}

type GhCommitListItem = {
	sha: string;
	commit: { message: string; author?: { name?: string; date?: string } | null };
	author?: { login?: string } | null;
};

/**
 * Dalın (ya da `path` alt ağacının) en yeni commit'leri. Dosya bazlı son
 * değişiklik eşlemesi için ucuzdur: tek istek, en yeni sıralı.
 */
export async function listCommits(
	token: string,
	fullName: string,
	options: { ref?: string; path?: string; perPage?: number } = {},
): Promise<CommitInfo[]> {
	const { owner, repo } = splitFullName(fullName);
	const params = new URLSearchParams({ per_page: String(options.perPage ?? 30) });
	if (options.ref) params.set("sha", options.ref);
	if (options.path) params.set("path", options.path);
	const data = await gh<GhCommitListItem[]>(
		token,
		`/repos/${owner}/${repo}/commits?${params}`,
	);
	return data.map((item) => ({
		sha: item.sha,
		message: item.commit.message,
		authorName: item.author?.login ?? item.commit.author?.name ?? "bilinmiyor",
		authorLogin: item.author?.login,
		date: item.commit.author?.date ?? new Date().toISOString(),
	}));
}
