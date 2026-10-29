// Admin arayüzünün istemci API'si — git, projeler ve içerik uçları.

import type {
	CommitFile,
	CommitResult,
	CompareFile,
	GitFile,
	MediaLinkFormat,
	R2MediaConfig,
	RepoSummary,
	TreeEntry,
} from "@wuppycms/shared";
import type { CollectionDef } from "@wuppycms/content-schema";

export type { RepoSummary };

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, { credentials: "same-origin", ...init });
	if (!res.ok) {
		let message = `İstek başarısız (${res.status})`;
		try {
			const data = (await res.json()) as { message?: string };
			if (data.message) message = data.message;
		} catch {
			// gövde JSON değil — varsayılan mesaj kalır
		}
		throw new ApiError(res.status, message);
	}
	return (await res.json()) as T;
}

/**
 * Gövdeyi gönderirken BAYT ilerlemesi veren POST — fetch yüklenen baytları
 * açmadığı için XHR. Yanıt/yakalama davranışı request() ile aynı.
 */
export function requestWithProgress<T>(
	url: string,
	body: unknown,
	onProgress: (fraction: number) => void,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.withCredentials = true;
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(Math.min(1, event.loaded / event.total));
		};
		xhr.onload = () => {
			let data: unknown = null;
			try {
				data = JSON.parse(xhr.responseText);
			} catch {
				// gövde JSON değil — varsayılan mesaj aşağıda
			}
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(data as T);
				return;
			}
			const message = (data as { message?: string } | null)?.message ?? `İstek başarısız (${xhr.status})`;
			reject(new ApiError(xhr.status, message));
		};
		xhr.onerror = () => reject(new ApiError(0, "Ağ hatası — bağlantı koptu."));
		xhr.send(JSON.stringify(body));
	});
}

// --- oturum -----------------------------------------------------------------

export type SessionUser = { id: string; name: string; email: string; image?: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
	// better-auth oturum yoksa düz `null` döner.
	const data = await request<null | { user: SessionUser | null }>(
		"/api/auth/get-session",
	).catch(() => null);
	return data?.user ?? null;
}

export async function signOut(): Promise<void> {
	await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
}

// --- projeler (siteler) -------------------------------------------------------

export type ProjectRow = {
	id: string;
	name: string;
	repo_full_name: string;
	default_branch: string;
};

export function listProjects(): Promise<{ projects: ProjectRow[] }> {
	return request(`/api/projects`);
}

export function createProject(fullName: string): Promise<{ id: string }> {
	return request(`/api/projects`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName }),
	});
}

export function listRepos(): Promise<{ repos: RepoSummary[] }> {
	return request(`/api/git/repos`);
}

// --- Astro sayfaları (src/pages) -----------------------------------------------

export type PageFile = { path: string; size: number };

export function listPages(
	fullName: string,
	ref?: string,
): Promise<{ ref: string; pages: PageFile[]; truncated: boolean }> {
	const params = new URLSearchParams({ full_name: fullName });
	if (ref) params.set("ref", ref);
	return request(`/api/pages?${params}`);
}

// --- içerik -------------------------------------------------------------------

export type SchemaResponse = {
	path: string | null;
	ref: string;
	collections: CollectionDef[];
	configFound: boolean;
};

export function getSchema(fullName: string): Promise<SchemaResponse> {
	return request(`/api/content/schema?full_name=${encodeURIComponent(fullName)}`);
}

export type EntryRow = {
	path: string;
	slug: string;
	title: string;
	date: string;
	draft: boolean;
	/** P3: frontmatter `status` (draft/review/ready) — pano kolonları. */
	status: string;
	lastCommit?: { sha: string; message: string; author: string; date: string };
};

export function getEntries(
	fullName: string,
	collection: string,
): Promise<{ ref: string; entries: EntryRow[]; truncated: boolean }> {
	const params = new URLSearchParams({ full_name: fullName, collection });
	return request(`/api/content/entries?${params}`);
}

export function createEntry(
	fullName: string,
	collection: string,
	title: string,
	slug?: string,
): Promise<CommitResult & { path: string }> {
	return request(`/api/content/entry`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, collection, title, slug }),
	});
}

// --- site (sihirbaz + ayarlar) ----------------------------------------------------

export type ScanCollection = CollectionDef & { entryCount: number };

export type SiteEntry = {
	key: string;
	name: string;
	url?: string;
	media?: string;
	mediaLink?: MediaLinkFormat;
	mediaR2?: R2MediaConfig;
	publishing?: "review" | "immediate";
	collections?: string[];
};

export type ScanResult = {
	fullName: string;
	ref: string;
	astro: boolean;
	astroConfigFound: boolean;
	siteUrl: string | null;
	configFound: boolean;
	collections: ScanCollection[];
	media: string | null;
	hasPublic: boolean;
	setup: { version: number; sites: SiteEntry[] } | null;
	/** sites.jsonc şema sorunları (OSS self-host: net hatalar). */
	setupIssues?: { path: string; message: string }[];
	treeTruncated: boolean;
};

export function scanSite(fullName: string): Promise<ScanResult> {
	return request(`/api/site/scan?full_name=${encodeURIComponent(fullName)}`);
}

export function putSiteConfig(fullName: string, sites: SiteEntry[]): Promise<CommitResult> {
	return request(`/api/site/config`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, sites }),
	});
}

// --- git ------------------------------------------------------------------------

export function getFile(fullName: string, path: string, ref?: string): Promise<GitFile> {
	const params = new URLSearchParams({ full_name: fullName, path });
	if (ref) params.set("ref", ref);
	return request(`/api/git/file?${params}`);
}

export function getTree(
	fullName: string,
	ref?: string,
): Promise<{ ref: string; entries: TreeEntry[]; truncated: boolean }> {
	const params = new URLSearchParams({ full_name: fullName });
	if (ref) params.set("ref", ref);
	return request(`/api/git/tree?${params}`);
}

export type CommitInfo = {
	sha: string;
	message: string;
	authorName: string;
	authorLogin?: string;
	date: string;
};

export function listCommits(
	fullName: string,
	options: { ref?: string; path?: string; perPage?: number } = {},
): Promise<{ commits: CommitInfo[] }> {
	const params = new URLSearchParams({ full_name: fullName, per_page: String(options.perPage ?? 30) });
	if (options.ref) params.set("ref", options.ref);
	if (options.path) params.set("path", options.path);
	return request(`/api/git/commits?${params}`);
}

export function uploadFile(
	fullName: string,
	branch: string,
	path: string,
	base64: string,
	message?: string,
): Promise<CommitResult> {
	return request(`/api/git/upload`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, branch, path, content: base64, message }),
	});
}

export function commitFiles(
	fullName: string,
	branch: string,
	message: string,
	files: CommitFile[],
): Promise<CommitResult> {
	return request(`/api/git/commit`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, branch, message, files }),
	});
}

// --- R2 medya kitaplığı (platform binding) ------------------------------------------

export type R2Object = { key: string; size: number; uploaded: string };

export function r2List(prefix: string, cursor?: string): Promise<{
	objects: R2Object[];
	truncated: boolean;
	cursor: string | null;
}> {
	const params = new URLSearchParams({ prefix });
	if (cursor) params.set("cursor", cursor);
	return request(`/api/media/r2?${params}`);
}

export function r2Upload(key: string, base64: string, contentType: string): Promise<{ key: string }> {
	return request(`/api/media/r2`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key, content: base64, contentType }),
	});
}

export function r2Delete(key: string): Promise<{ ok: boolean }> {
	return request(`/api/media/r2?key=${encodeURIComponent(key)}`, { method: "DELETE" });
}

// --- medya meta / taşıma / kullanım (D1 + git) ---------------------------------

export function getMediaAlts(fullName: string): Promise<{
	alts: Record<string, string>;
	captions: Record<string, string>;
	focals: Record<string, { x: number; y: number }>;
	widths: Record<string, number>;
}> {
	return request(`/api/media/alt?full_name=${encodeURIComponent(fullName)}`);
}

export function putMediaAlt(
	fullName: string,
	path: string,
	fields: {
		alt?: string;
		caption?: string;
		focal?: { x: number; y: number } | null;
		width?: number | null;
	},
): Promise<{
	ok: boolean;
	alt: string;
	caption: string;
	focal: { x: number; y: number } | null;
	width: number | null;
}> {
	return request(`/api/media/alt`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, path, ...fields }),
	});
}

export function moveMedia(
	fullName: string,
	branch: string,
	from: string,
	to: string,
): Promise<{ ok: boolean; path: string }> {
	return request(`/api/media/move`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, branch, from, to }),
	});
}

export function moveR2(key: string, to: string): Promise<{ ok: boolean; path: string }> {
	return request(`/api/media/move`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ r2_key: key, to }),
	});
}

export type MediaUse = { path: string; field: string; title: string };

export function usageScan(
	fullName: string,
	path: string,
	ref: string,
): Promise<{ uses: MediaUse[]; scanned: number; truncated: boolean }> {
	const params = new URLSearchParams({ full_name: fullName, path, ref });
	return request(`/api/media/usage?${params}`);
}

// --- BYO AI (P5) -------------------------------------------------------------------

export type AiSettings = {
	provider: "openai" | "gemini" | "anthropic";
	baseUrl: string;
	model: string;
	hasKey: boolean;
};

export type AiGenerateInput = {
	prompt: string;
	tone?: string;
	length?: string;
	language?: string;
	keyword?: string;
	title?: string;
};

export function getAiSettings(): Promise<AiSettings> {
	return request(`/api/ai/settings`);
}

export function putAiSettings(body: {
	provider: string;
	baseUrl: string;
	model: string;
	/** undefined → mevcut korunur; "" → silinir; dolu → şifrelenip yazılır. */
	apiKey?: string;
}): Promise<AiSettings & { ok: boolean }> {
	return request(`/api/ai/settings`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

export function aiGenerate(body: AiGenerateInput): Promise<{ text: string; provider: string; model: string }> {
	return request(`/api/ai/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

// --- Add Collection (parity) -------------------------------------------------------

export function createCollection(
	fullName: string,
	input: { key: string; base?: string; pattern?: string; fields?: string[] },
): Promise<{ ok: boolean; key: string; base: string; pattern: string }> {
	return request(`/api/content/collection`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, ...input }),
	});
}

// --- Ekip / izinler (parity 2b) ----------------------------------------------------

export type TeamMember = { userId: string; role: string; name: string; email: string; joinedAt: string };
export type TeamInvitation = { id: string; email: string; role: string; createdAt: string; invitePath: string };

export function getTeam(projectId: string): Promise<{
	role: string;
	owner: { name: string; email: string };
	members: TeamMember[];
	invitations: TeamInvitation[];
}> {
	return request(`/api/team/members?project_id=${encodeURIComponent(projectId)}`);
}

export function inviteMember(
	projectId: string,
	email: string,
	role: "editor" | "viewer",
): Promise<{ ok: boolean; id: string; email: string; role: string; invitePath: string }> {
	return request(`/api/team/invite`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ project_id: projectId, email, role }),
	});
}

export function acceptInvite(token: string): Promise<{
	ok: boolean;
	project: { id: string; name: string; repoFullName: string; branch: string } | null;
	role: string;
}> {
	return request(`/api/team/accept`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token }),
	});
}

export function removeMember(projectId: string, userId: string): Promise<{ ok: boolean }> {
	return request(`/api/team/members`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ project_id: projectId, user_id: userId }),
	});
}

export function revokeInvitation(projectId: string, invitationId: string): Promise<{ ok: boolean }> {
	return request(`/api/team/invitations`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ project_id: projectId, invitation_id: invitationId }),
	});
}

// --- İnceleme akışı (parity 2b-ii) --------------------------------------------------

export type ReviewDecision = "approved" | "changes_requested" | null;

export type PullRequestRow = {
	number: number;
	title: string;
	body: string;
	state: "open" | "closed";
	merged: boolean;
	draft: boolean;
	head: string;
	base: string;
	author: string;
	createdAt: string;
	reviews: { state: "approved" | "changes_requested" | "commented"; body: string; author: string; submittedAt: string }[];
	decision: ReviewDecision;
};

export function listReviewPulls(fullName: string, state: "open" | "all" = "open"): Promise<{ pulls: PullRequestRow[] }> {
	return request(`/api/review/list?full_name=${encodeURIComponent(fullName)}&state=${state}`);
}

export function startReview(
	fullName: string,
	input: { path: string; content: string; title?: string; body?: string },
): Promise<{ ok: boolean; number: number; branch: string }> {
	return request(`/api/review/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, ...input }),
	});
}

export function reviewDecision(
	fullName: string,
	number: number,
	event: "APPROVE" | "REQUEST_CHANGES",
	body?: string,
): Promise<{ ok: boolean }> {
	return request(`/api/review/decision`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, number, event, body }),
	});
}

export function mergeReview(fullName: string, number: number): Promise<{ ok: boolean; sha?: string }> {
	return request(`/api/review/merge`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, number }),
	});
}

export function closeReview(fullName: string, number: number): Promise<{ ok: boolean }> {
	return request(`/api/review/close`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ full_name: fullName, number }),
	});
}

export function compareRefs(
	fullName: string,
	base: string,
	head: string,
): Promise<{ aheadBy: number; files: CompareFile[] }> {
	const params = new URLSearchParams({ full_name: fullName, base, head });
	return request(`/api/git/compare?${params}`);
}
