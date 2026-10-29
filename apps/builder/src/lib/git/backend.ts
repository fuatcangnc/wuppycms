// Backend sözleşmesi — git sağlayıcılarının (github; ileride gitlab/gitea)
// uyduğu arayüz, ortak hata tipi ve root dizin sarmalayıcısı.
// Desen Sveltia'nın `BackendService` sözleşmesinden uyarlanmıştır
// (bkz. docs/sveltia-analysis.md); ADR 0006: çekirdek sağlayıcıdan bağımsızdır.

import type {
	BranchInfo,
	CommitAuthor,
	CommitFile,
	CommitInfo,
	CommitResult,
	CompareFile,
	GitFile,
	PullRequestInfo,
	RepoInfo,
	RepoSummary,
	ReviewState,
	TreeEntry,
} from "@wuppycms/shared";

/** Sağlayıcıdan bağımsız git hatası; HTTP durumu taşır. */
export class BackendError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly body?: unknown,
	) {
		super(message);
		this.name = "BackendError";
	}
}

export type BackendName = "github";

/**
 * Bir git sağlayıcısının uyguladığı sözleşme. Her metot token'ı ilk argüman
 * alır (kimlik çağrı başına çözülür); `commitFiles` tek atomik commit atar.
 */
export interface BackendService {
	readonly name: BackendName;
	readonly label: string;
	/** Git sağlayıcısı mı (dosya deposu backend'leri için false olabilir). */
	readonly isGit: boolean;

	getRepo(token: string, fullName: string): Promise<RepoInfo>;
	listUserRepos(token: string): Promise<RepoSummary[]>;
	getBranch(token: string, fullName: string, branch: string): Promise<BranchInfo>;
	listBranches(token: string, fullName: string): Promise<BranchInfo[]>;
	listTree(
		token: string,
		fullName: string,
		ref: string,
		recursive?: boolean,
	): Promise<{ entries: TreeEntry[]; truncated: boolean }>;
	getFile(token: string, fullName: string, path: string, ref?: string): Promise<GitFile>;
	getBlobBase64(token: string, fullName: string, sha: string): Promise<string>;
	compareCommits(
		token: string,
		fullName: string,
		base: string,
		head: string,
	): Promise<{ aheadBy: number; files: CompareFile[] }>;
	listCommits(
		token: string,
		fullName: string,
		options: { ref?: string; path?: string; perPage?: number },
	): Promise<CommitInfo[]>;
	commitFiles(
		token: string,
		fullName: string,
		branch: string,
		files: CommitFile[],
		message: string,
		author?: CommitAuthor,
		coAuthor?: CommitAuthor,
	): Promise<CommitResult | null>;

	// --- inceleme akışı (opsiyonel; git sağlayıcıları) — parity 2b-ii ---
	/** Dalın ucundaki commit'ten yeni dal açar. */
	createBranch?(token: string, fullName: string, branch: string, sha: string): Promise<void>;
	listPullRequests?(
		token: string,
		fullName: string,
		state?: "open" | "closed" | "all",
	): Promise<PullRequestInfo[]>;
	getPullRequest?(token: string, fullName: string, number: number): Promise<PullRequestInfo>;
	createPullRequest?(
		token: string,
		fullName: string,
		input: { title: string; body?: string; head: string; base: string; draft?: boolean },
	): Promise<PullRequestInfo>;
	listReviews?(
		token: string,
		fullName: string,
		number: number,
	): Promise<{ state: ReviewState; body: string; author: string; submittedAt: string }[]>;
	submitReview?(
		token: string,
		fullName: string,
		number: number,
		event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
		body?: string,
	): Promise<void>;
	mergePullRequest?(
		token: string,
		fullName: string,
		number: number,
	): Promise<{ merged: boolean; sha?: string; message?: string }>;
	closePullRequest?(token: string, fullName: string, number: number): Promise<void>;
}

/**
 * Yolları bir kök dizine göre saran dekoratör (Sveltia `scopeBackendService`).
 * Girdi yollarına kökü ekler, dönen yollardan kökü soyar — sağlayıcı kendi
 * içinde yol bilmez; çok-siteli repolar (site başına kök) tek noktadan çözülür.
 */
export function scopeBackendService(service: BackendService, rootDir: string): BackendService {
	const root = rootDir.replace(/^\/+|\/+$/g, "");
	if (!root) return service;

	const withRoot = (path: string) => `${root}/${path.replace(/^\/+/, "")}`;
	const stripRoot = (path: string) => (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);

	return {
		...service,
		listTree: async (...args) => {
			const result = await service.listTree(...args);
			return {
				...result,
				entries: result.entries.map((entry) => ({ ...entry, path: stripRoot(entry.path) })),
			};
		},
		getFile: async (token, fullName, path, ref) => {
			const file = await service.getFile(token, fullName, withRoot(path), ref);
			return { ...file, path: stripRoot(file.path) };
		},
		commitFiles: async (token, fullName, branch, files, message, author, coAuthor) => {
			const result = await service.commitFiles(
				token,
				fullName,
				branch,
				files.map((file) => ({ ...file, path: withRoot(file.path) })),
				message,
				author,
				coAuthor,
			);
			return result ? { ...result, files: result.files.map(stripRoot) } : null;
		},
	};
}
