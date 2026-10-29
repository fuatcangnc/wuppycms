// SSR açılış yükleyicisi — yalnız Astro sayfalarından çağrılır (workerd içi).
//
// /api uçlarının Hono uygulamasını AĞA ÇIKMADAN süreç içinden çağırır
// (api.fetch): kimlik çözümü, tarama mantığı ve hata davranışı API ile
// birebir aynıdır; tek fark git gidiş-dönüşü yerine bellek içi çağırmadır.
// Yükleme başarısız olursa alan ATLANIR — ada o ekranı istemcide normal
// /api yoluyla doldurmaya devam eder (SSR hız iyileştirmesi, sert bağımlılık değil).

import { api } from "@/api/app";
import { getEnv } from "@/lib/session";
import { docSlug, parseAdminPath } from "./url";
import type {
	CommitInfo,
	EntryRow,
	PullRequestRow,
	ProjectRow,
	ScanResult,
} from "./api";
import type { GitFile, TreeEntry } from "@wuppycms/shared";
import type { BootPayload, MediaMeta } from "./boot";

/** Süreç içi çağrının sahte konağı — hiçbir ağ isteği üretmez. */
const INTERNAL_HOST = "http://boot.internal";

const executionStub = {
	waitUntil: () => undefined,
	passThroughOnException: () => undefined,
	props: {},
} as unknown as ExecutionContext;

type SessionLike = { user: { id: string; name?: string; email?: string } | null } | null;

export async function loadBoot(
	request: Request,
	session: SessionLike,
): Promise<BootPayload | null> {
	const env = getEnv();
	const cookie = request.headers.get("cookie") ?? "";
	const url = new URL(request.url);

	const call = async <T>(path: string): Promise<T | null> => {
		const where = path.split("?")[0];
		try {
			const res = await api.fetch(
				new Request(`${INTERNAL_HOST}${path}`, { headers: { cookie } }),
				env,
				executionStub,
			);
			if (!res.ok) {
				// Bozulma sessiz yutma — tail'de görünsün (ada istemcide tamamlar).
				console.warn(`[boot] ${where} → HTTP ${res.status}`);
				return null;
			}
			return (await res.json()) as T;
		} catch (error) {
			console.warn(`[boot] ${where} → ${String(error).slice(0, 160)}`);
			return null;
		}
	};

	const email = session?.user?.email ?? "";
	const boot: BootPayload = {
		user: session?.user ? { name: session.user.name || email, email } : null,
		sites: [],
	};

	const projects = await call<{ projects: ProjectRow[] }>("/projects");
	if (!projects) return null; // oturum/D1 sorunu — ada istemcide aynı yoldan devam eder
	boot.sites = projects.projects.map((p) => ({
		id: p.id,
		name: p.name,
		repoFullName: p.repo_full_name,
		branch: p.default_branch,
	}));

	const requestedRaw = url.searchParams.get("site") ?? url.searchParams.get("repo") ?? "";
	const repo =
		boot.sites.find((s) => s.id === requestedRaw || s.repoFullName === requestedRaw)
			?.repoFullName ?? boot.sites[0]?.repoFullName;
	if (!repo) return boot;

	const scan = await call<ScanResult>(`/site/scan?full_name=${encodeURIComponent(repo)}`);
	if (!scan) return boot;
	boot.scan = { repo: scan.fullName, scan };

	const q = (extra: Record<string, string>) =>
		new URLSearchParams({ full_name: repo, ...extra }).toString();
	const route = parseAdminPath(url.pathname);

	const fetchEntries = async (collection: string) => {
		const data = await call<{ entries: EntryRow[]; truncated: boolean }>(
			`/content/entries?${q({ collection })}`,
		);
		if (!data) return null;
		boot.entries = { repo, collection, rows: data.entries, truncated: data.truncated };
		return data;
	};

	switch (route.kind) {
		case "entries":
		case "legacy-collection":
			await fetchEntries(route.collection);
			break;
		case "doc": {
			const rows = (await fetchEntries(route.collection))?.entries ?? [];
			const hit = rows.find((row) => docSlug(row.path) === route.docSlug);
			if (hit) {
				const file = await call<GitFile>(`/git/file?${q({ path: hit.path })}`);
				if (file) boot.doc = { repo, path: hit.path, file };
			}
			break;
		}
		case "legacy-doc": {
			const file = await call<GitFile>(`/git/file?${q({ path: route.path })}`);
			if (file) boot.doc = { repo, path: route.path, file };
			break;
		}
		case "contentmd": {
			const file = await call<GitFile>(`/git/file?${q({ path: "CONTENT.md" })}`);
			if (file) boot.contentmd = { repo, text: file.content };
			break;
		}
		case "media": {
			// R2 kitaplığı istemcide kalır; depo kitaplığında listeyi ve meta
			// manifestini sunucuda hazırla (refreshMedia ile aynı süzgeç).
			const library = url.searchParams.get("mediaLibrary");
			if (library !== "platform_r2" && library !== "r2") {
				const entry = scan.setup?.sites?.find((s) => s.key === "root") ?? scan.setup?.sites?.[0];
				const root = (entry?.media ?? scan.media ?? "public").replace(/\/+$/, "");
				const tree = await call<{ entries: TreeEntry[] }>(`/git/tree?${q({})}`);
				const alt = await call<MediaMeta>(`/media/alt?full_name=${encodeURIComponent(repo)}`);
				if (tree) {
					const prefix = root ? `${root}/` : "";
					boot.media = {
						repo,
						items: tree.entries
							.filter((e) => e.type === "blob" && e.path.startsWith(prefix))
							.slice(0, 500)
							.map((e) => ({ path: e.path, size: e.size })),
						meta: alt ?? null,
					};
				}
			}
			break;
		}
		case "trash":
			// Çöp listesi istemcide kalır (seyrek kullanılan ekran).
			break;
		case "settings":
			// Site ayarları formu taramadan beslenir; ek tohum gerekmez.
			break;
		case "page":
			// Sayfa kaynağı istemcide yüklenir; ek tohum gerekmez.
			break;
		case "review": {
			const data = await call<{ pulls: PullRequestRow[] }>(`/review/list?${q({ state: "open" })}`);
			if (data) boot.reviews = { repo, pulls: data.pulls };
			break;
		}
		default: {
			const data = await call<{ commits: CommitInfo[] }>(`/git/commits?${q({ per_page: "8" })}`);
			if (data) boot.commits = { repo, commits: data.commits };
			break;
		}
	}
	return boot;
}
