// Projeler ekranı adası — sunucudan gelen listeyi çizir; depo seçip proje
// oluşturma, silme ve çıkış istemcide çalışır.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { SkeletonRows } from "@/components/ui-react/skeleton";
import { BuildWithAi } from "./BuildWithAi";
import { t } from "@/lib/i18n";

export type ProjectRow = {
	id: string;
	name: string;
	repo_full_name: string;
	default_branch: string;
	created_at: string;
};

type RepoSummary = { fullName: string; private: boolean; source?: "app" | "oauth" | "env" };
type RepoInfo = RepoSummary & { astro: boolean; wuppy: boolean; defaultBranch: string };

type Installation = {
	installation_id: string;
	account_login: string | null;
	account_type: string | null;
	repository_selection: string | null;
};

type AppStatus = {
	app: { configured: boolean; slug: string; installUrl: string; manageUrl: string };
	installations: Installation[];
};

export default function ProjectsIsland({
	projects: initial,
	userName,
}: {
	projects: ProjectRow[];
	userName: string;
}) {
	const [panelOpen, setPanelOpen] = useState(initial.length === 0);
	const [repos, setRepos] = useState<RepoSummary[] | null>(null);
	const [query, setQuery] = useState("");
	const [error, setError] = useState("");
	const [creating, setCreating] = useState(false);
	const [checking, setChecking] = useState<string | null>(null);
	const [notAstro, setNotAstro] = useState<RepoSummary | null>(null);
	const [mode, setMode] = useState<"projects" | "build">("projects");
	const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
	const [deploying, setDeploying] = useState<string | null>(null);
	const [needsApp, setNeedsApp] = useState(false);
	const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

	// GitHub App durumu — kurulum dönüşünde (?github_app=…) kullanıcıya sonucu
	// göster; kurulum yoksa panele "App'i kur" kartı düşer.
	useEffect(() => {
		void (async () => {
			try {
				const res = await fetch("/api/github/app/status", { credentials: "same-origin" });
				if (res.ok) setAppStatus((await res.json()) as AppStatus);
			} catch {
				// durum bilgisi kritik değil — repo listesi yine çalışır
			}
		})();
		const flag = new URLSearchParams(window.location.search).get("github_app");
		const messages: Record<string, { kind: "ok" | "error"; text: string }> = {
			installed: { kind: "ok", text: t("project.app.installed") },
			missing: { kind: "error", text: t("project.app.missing") },
			no_db: { kind: "error", text: t("project.app.no_db") },
			state_mismatch: { kind: "error", text: t("project.app.state_mismatch") },
		};
		if (flag && messages[flag]) setNotice(messages[flag]);
	}, []);

	const openPanel = () => {
		setPanelOpen(true);
		if (repos) return;
		void (async () => {
			try {
				const res = await fetch("/api/git/repos", { credentials: "same-origin" });
				if (!res.ok) {
					if (res.status === 401) setNeedsApp(true);
					const data = (await res.json().catch(() => ({}))) as { message?: string };
					throw new Error(data.message ?? t("project.requestStatus", { status: res.status }));
				}
				const data = (await res.json()) as { repos: RepoSummary[] };
				setRepos(data.repos ?? []);
			} catch (err) {
				setError(err instanceof Error ? err.message : t("project.reposFailed"));
			}
		})();
	};

	// Proje yokken panel açık doğar; o durumda repolar mount'ta yüklenir.
	// (openPanel() yalnız düğme tıklayınca çağrıldığından, aksi halde iskelet
	// sonsuza kadar kalırdı — openPanel kendi içinde `if (repos) return` ile
	// korunduğu için çift istek olmaz.)
	useEffect(() => {
		if (panelOpen && !repos) openPanel();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const selectRepo = (repo: RepoSummary) => {
		if (creating || checking) return;
		setChecking(repo.fullName);
		setNotAstro(null);
		setError("");
		void (async () => {
			try {
				const res = await fetch(`/api/git/repo-info?full_name=${encodeURIComponent(repo.fullName)}`, {
					credentials: "same-origin",
				});
				if (!res.ok) {
					const data = (await res.json().catch(() => ({}))) as { message?: string };
					throw new Error(data.message ?? t("project.requestStatus", { status: res.status }));
				}
				const info = (await res.json()) as RepoInfo;
				if (!info.astro) {
					setNotAstro(repo);
					return;
				}
				createProject(repo.fullName);
			} catch (err) {
				setError(err instanceof Error ? err.message : t("build.checkFailed"));
			} finally {
				setChecking(null);
			}
		})();
	};

	const createProject = (fullName: string) => {
		if (creating) return;
		setCreating(true);
		void (async () => {
			try {
				const res = await fetch("/api/projects", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ full_name: fullName }),
				});
				if (!res.ok) {
					const data = (await res.json().catch(() => ({}))) as { message?: string };
					throw new Error(data.message ?? t("project.requestStatus", { status: res.status }));
				}
				window.location.assign(`/admin?site=${encodeURIComponent(fullName)}`);
			} catch (err) {
				setCreating(false);
				setError(err instanceof Error ? err.message : t("project.createFailed"));
			}
		})();
	};

	/** Eksik/bozuk Cloudflare Pages yayınını onarır (adresleri de yazar). */
	const redeploy = (fullName: string) => {
		if (deploying) return;
		setDeploying(fullName);
		setNotice(null);
		void (async () => {
			try {
				const res = await fetch("/api/deploy/sync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ full_name: fullName }),
				});
				const data = (await res.json().catch(() => ({}))) as {
					results?: Array<{ ok: boolean; previewUrl?: string; error?: string }>;
					message?: string;
				};
				const result = data.results?.[0];
				if (!res.ok || !result?.ok) {
					throw new Error(result?.error ?? data.message ?? t("project.deployFailed"));
				}
				setNotice({
					kind: "ok",
					text: t("project.deployDone", { url: result.previewUrl ?? "" }),
				});
			} catch (err) {
				setNotice({
					kind: "error",
					text: err instanceof Error ? err.message : t("project.deployFailed"),
				});
			} finally {
				setDeploying(null);
			}
		})();
	};

	const removeProject = (id: string) => {		void (async () => {
			await fetch(`/api/projects/${id}`, { method: "DELETE", credentials: "same-origin" });
			window.location.reload();
		})();
	};

	const signOut = () => {
		void (async () => {
			await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
			window.location.assign("/login");
		})();
	};

	const q = query.trim().toLowerCase();
	const matched = (repos ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q));

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-8">
				<div className="flex items-center gap-4">
					<a href="/" className="flex items-center gap-2 text-sm font-semibold">
						<span className="inline-block size-5 rounded-md bg-primary" />
						WuppyCMS
					</a>
					<span className="text-sm text-muted-foreground">{t("project.title")}</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="max-w-44 truncate text-xs text-muted-foreground">{userName}</span>
					<Button variant="ghost" size="sm" onClick={signOut}>{t("sidebar.signOut")}</Button>
				</div>
			</header>

			{mode === "build" ? (
				<BuildWithAi onClose={() => setMode("projects")} />
			) : (
			<main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-semibold tracking-tight">{t("project.mine")}</h1>
					<Button size="sm" onClick={() => (panelOpen ? setPanelOpen(false) : openPanel())}>
						+ {t("project.new")}
					</Button>
				</div>

				{notice && (
					<div
						role="status"
						className={
							notice.kind === "ok"
								? "mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm"
								: "mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
						}
					>
						{notice.text}
					</div>
				)}

				{appStatus && (
					<div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						{appStatus.installations.length > 0 ? (
							<>
								<span>
									{t("project.app.connected", {
										accounts: appStatus.installations
											.map((entry) => `@${entry.account_login ?? "?"}`)
											.join(", "),
									})}
								</span>
								<a
									href={appStatus.app.manageUrl}
									target="_blank"
									rel="noreferrer"
									className="font-medium text-foreground hover:underline"
								>
									{t("project.app.manage")}
								</a>
							</>
						) : (
							<>
								<span>{t("project.app.none")}</span>
								{appStatus.app.configured && (
									<a
										href={appStatus.app.installUrl}
										className="font-medium text-primary hover:underline"
									>
										{t("project.app.install")}
									</a>
								)}
							</>
						)}
					</div>
				)}

				{panelOpen && (
					<section className="mt-6 rounded-xl border border-border bg-card p-5">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h2 className="font-semibold">{t("project.newHeading")}</h2>
								<p className="mt-1 text-sm text-muted-foreground">{t("project.newHint")}</p>
							</div>
							<Button type="button" variant="outline" size="sm" onClick={() => setMode("build")}>
								✦ {t("build.startWithAi")}
							</Button>
						</div>
						{(needsApp || (appStatus && !appStatus.installations.length && appStatus.app.configured)) && (
							<div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
								<p className="text-sm font-semibold">{t("project.app.title")}</p>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									{t("project.app.body")}
								</p>
								<Button as="a" href="/api/github/app/install" size="sm" className="mt-3">
									{t("project.app.install")}
								</Button>
							</div>
						)}
						<Input
							size="sm"
							className="mt-4"
							placeholder={t("project.filterPlaceholder")}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
						{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
						{notAstro ? (
							<div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
								<p className="text-sm font-semibold">{t("build.notAstroTitle")}</p>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									{t("build.notAstroBody", { repo: notAstro.fullName })}
								</p>
								<div className="mt-3 flex flex-wrap gap-2">
									<Button type="button" size="sm" onClick={() => setMode("build")}>
										{t("build.notAstroAction")}
									</Button>
									<Button type="button" variant="ghost" size="sm" onClick={() => setNotAstro(null)}>
										{t("build.chooseAnother")}
									</Button>
								</div>
							</div>
						) : null}
						<div className="mt-3 grid max-h-80 gap-1 overflow-y-auto px-0.5">
							{!repos && !error && <SkeletonRows rows={5} className="rounded-lg border border-border" />}
							{repos &&
								matched.map((repo) => (
									<button
										key={repo.fullName}
										type="button"
										disabled={creating || checking !== null}
										onClick={() => selectRepo(repo)}
										className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
									>
										<span className="truncate font-medium">{repo.fullName}</span>
										<span className="shrink-0 text-xs text-muted-foreground">
											{checking === repo.fullName
												? t("build.kicker")
												: [
														repo.source === "app" ? t("project.app.badge") : "",
														repo.private ? t("project.private") : t("project.public"),
													]
														.filter(Boolean)
														.join(" · ")}
										</span>
									</button>
								))}
							{repos && matched.length === 0 && (
								<p className="px-3 py-1 text-sm text-muted-foreground">{t("project.noMatch")}</p>
							)}
						</div>
					</section>
				)}

				<div className="mt-6 grid gap-3">
					{initial.map((project) => (
						<div
							key={project.id}
							className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4"
						>
							<div className="min-w-0">
								<a
									href={`/admin?site=${encodeURIComponent(project.repo_full_name)}`}
									className="truncate font-medium hover:underline"
								>
									{project.name}
								</a>
								<p className="mt-0.5 truncate text-xs text-muted-foreground">
									{project.repo_full_name} · {project.default_branch} ·{" "}
									{project.created_at.slice(0, 10)}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									variant="outline"
									size="sm"
									disabled={deploying === project.repo_full_name}
									onClick={() => redeploy(project.repo_full_name)}
								>
									{deploying === project.repo_full_name
										? t("project.deploying")
										: t("project.deploy")}
								</Button>
								<Button
									as="a"
									href={`/admin?site=${encodeURIComponent(project.repo_full_name)}`}
									size="sm"
								>
									{t("project.open")}
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={t("project.remove")}
									onClick={() => removeProject(project.id)}
								>
									<span className="text-sm">✕</span>
								</Button>
							</div>
						</div>
					))}
				</div>

				{initial.length === 0 && (
					<p className="mt-6 text-sm text-muted-foreground">
						{t("project.empty")}
					</p>
				)}
			</main>
			)}
		</div>
	);
}
