// Git katmanının giriş noktası — sağlayıcı kayıt defteri + facade.
//
// Sözleşme ve sarmalayıcılar: ./backend.ts. Sağlayıcılar: ./github/.
// Yeni sağlayıcı (gitlab/gitea) eklemek: klasörü yaz, `backends`e kaydet.
// Mevcut çağrı yerleri facade fonksiyonlarını kullanır; yeni kod
// `getBackend()` üzerinden gider.

import type { BackendName, BackendService } from "./backend";
import { githubBackend } from "./github";

export type { BackendName, BackendService } from "./backend";
export { BackendError, scopeBackendService } from "./backend";
export { setGitHubApiBase } from "./github/api";

/** Kayıtlı sağlayıcılar. */
export const backends: Record<BackendName, BackendService> = {
	github: githubBackend,
};

let activeName: BackendName = "github";

/** Etkin sağlayıcıyı değiştirir (çok sağlayıcı desteği geldiğinde kullanılır). */
export function selectBackend(name: BackendName): void {
	activeName = name;
}

/** Etkin (ya da adı verilen) sağlayıcı servisi. */
export function getBackend(name?: BackendName): BackendService {
	return backends[name ?? activeName];
}

// --- facade: mevcut çağrı yerlerini değiştirmeden sözleşmeye bağlar ---------

export const getRepo: BackendService["getRepo"] = (...args) => getBackend().getRepo(...args);
export const listUserRepos: BackendService["listUserRepos"] = (...args) =>
	getBackend().listUserRepos(...args);
export const getBranch: BackendService["getBranch"] = (...args) => getBackend().getBranch(...args);
export const listBranches: BackendService["listBranches"] = (...args) =>
	getBackend().listBranches(...args);
export const listTree: BackendService["listTree"] = (...args) => getBackend().listTree(...args);
export const getFile: BackendService["getFile"] = (...args) => getBackend().getFile(...args);
export const getBlobBase64: BackendService["getBlobBase64"] = (...args) =>
	getBackend().getBlobBase64(...args);
export const compareCommits: BackendService["compareCommits"] = (...args) =>
	getBackend().compareCommits(...args);
export const listCommits: BackendService["listCommits"] = (...args) =>
	getBackend().listCommits(...args);
export const commitFiles: BackendService["commitFiles"] = (...args) =>
	getBackend().commitFiles(...args);

// --- inceleme akışı (parity 2b-ii) -------------------------------------------------

export const createBranch: NonNullable<BackendService["createBranch"]> = (...args) =>
	getBackend().createBranch!(...args);
export const listPullRequests: NonNullable<BackendService["listPullRequests"]> = (...args) =>
	getBackend().listPullRequests!(...args);
export const getPullRequest: NonNullable<BackendService["getPullRequest"]> = (...args) =>
	getBackend().getPullRequest!(...args);
export const createPullRequest: NonNullable<BackendService["createPullRequest"]> = (...args) =>
	getBackend().createPullRequest!(...args);
export const listReviews: NonNullable<BackendService["listReviews"]> = (...args) =>
	getBackend().listReviews!(...args);
export const submitReview: NonNullable<BackendService["submitReview"]> = (...args) =>
	getBackend().submitReview!(...args);
export const mergePullRequest: NonNullable<BackendService["mergePullRequest"]> = (...args) =>
	getBackend().mergePullRequest!(...args);
export const closePullRequest: NonNullable<BackendService["closePullRequest"]> = (...args) =>
	getBackend().closePullRequest!(...args);
