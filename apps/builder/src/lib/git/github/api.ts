// GitHub REST istemcisi — fetch tabanlı, Workers'ta hafif kalsın diye Octokit
// kullanılmaz. Bu modül yalnız HTTP katmanı: kök adres, kimlik başlıkları, hata.

import { BackendError } from "../backend";

/**
 * GitHub API kökü. Varsayılan api.github.com; ağsız E2E'de sahte sunucuya
 * yönlendirilir (`setGitHubApiBase`, her istekte API middleware'inden gelir).
 */
let apiBase = "https://api.github.com";

/** API kökünü değiştirir (boş/geçersiz değer varsayılana döner). */
export function setGitHubApiBase(base?: string): void {
	const trimmed = base?.trim().replace(/\/+$/, "");
	apiBase = trimmed || "https://api.github.com";
}

const USER_AGENT = "wuppycms-builder";

/** Kimlikli GitHub isteği; hata gövdesini `BackendError`e taşır. */
export async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${apiBase}${path}`, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": USER_AGENT,
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});
	if (!res.ok) {
		let body: unknown;
		try {
			body = await res.json();
		} catch {
			body = undefined;
		}
		const message =
			typeof body === "object" && body !== null && "message" in body
				? String((body as { message: unknown }).message)
				: `GitHub API isteği başarısız (${res.status})`;
		throw new BackendError(res.status, message, body);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

/** "owner/repo" biçimini doğrular ve parçalar. */
export function splitFullName(fullName: string): { owner: string; repo: string } {
	const [owner, repo, ...rest] = fullName.split("/");
	if (!owner || !repo || rest.length > 0) {
		throw new BackendError(400, `Geçersiz repo adı: "${fullName}" (beklenen: owner/repo)`);
	}
	return { owner, repo };
}
