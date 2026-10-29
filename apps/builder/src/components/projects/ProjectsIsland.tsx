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

type RepoSummary = { fullName: string; private: boolean };
type RepoInfo = RepoSummary & { astro: boolean; wuppy: boolean; defaultBranch: string };

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

	const openPanel = () => {
		setPanelOpen(true);
		if (repos) return;
		void (async () => {
			try {
				const res = await fetch("/api/git/repos", { credentials: "same-origin" });
				if (!res.ok) {
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

	const removeProject = (id: string) => {
		void (async () => {
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
												: repo.private
													? t("project.private")
													: t("project.public")}
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
