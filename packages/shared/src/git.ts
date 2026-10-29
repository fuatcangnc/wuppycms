// Git katmanının ortak tipleri — builder ve (ileride) diğer tüketiciler aynı
// sözleşmeyi kullanır. GitHub'a özgü alanlar en aza indirilmiştir.

/** Tek bir dosya değişikliği: içerik yaz ya da sil. */
export type CommitFile = {
	path: string;
	content?: string;
	delete?: boolean;
	/** content base64 kodlu ikili veri (medya yüklemeleri). */
	base64?: boolean;
};

/** Git ağacındaki tek girdi. */
export type TreeEntry = {
	path: string;
	type: "blob" | "tree" | "commit";
	sha: string;
	size?: number;
};

/** Okunan dosyanın çözülmüş hâli. */
export type GitFile = {
	path: string;
	sha: string;
	content: string;
};

/** Commit yazarı. */
export type CommitAuthor = {
	name: string;
	email: string;
};

/** Commit listesi satırı (tablolar ve "Recently updated" akışı için). */
export type CommitInfo = {
	sha: string;
	message: string;
	authorName: string;
	authorLogin?: string;
	/** ISO committer tarihi. */
	date: string;
};

/** Başarılı commit sonucu. */
export type CommitResult = {
	sha: string;
	branch: string;
	message: string;
	files: string[];
	url?: string;
};

/** İki revizyon arasındaki dosya farkı (diff görünümü için). */
export type CompareFile = {
	filename: string;
	status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
	additions: number;
	deletions: number;
	changes: number;
};

/** Repo özeti. */
export type RepoInfo = {
	fullName: string;
	defaultBranch: string;
	private: boolean;
	htmlUrl: string;
};

/** Depolar listesindeki satır (CMS "Depolar" ekranı). */
export type RepoSummary = RepoInfo & {
	description: string | null;
	pushedAt: string;
	/** Erişimin kaynağı: GitHub App kurulumu ya da OAuth/geliştirme token'ı. */
	source?: "app" | "oauth" | "env";
};

/** Dal özeti. */
export type BranchInfo = {
	name: string;
	sha: string;
};

// --- İnceleme akışı (parity 2b-ii): dal + pull request --------------------------

/** İnceleme sonucu (GitHub reviews API karşılığı). */
export type ReviewState = "approved" | "changes_requested" | "commented";

export type PullRequestInfo = {
	number: number;
	title: string;
	body: string;
	state: "open" | "closed";
	merged: boolean;
	draft: boolean;
	/** Kaynak dal (review/<slug>…). */
	head: string;
	/** Hedef dal (genelde main). */
	base: string;
	author: string;
	createdAt: string;
};
