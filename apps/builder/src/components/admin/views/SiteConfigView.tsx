// Site ayarları — SAYFA görünümü (modal değil). Kayıt `.wuppycms/sites.jsonc`
// commit'idir; medya alanları GitCMS'in "Settings → Media" karşılığıdır.
// Üyeler bölümü davet üretir (bağlantı paylaşılır) ve üyeleri listeler.

import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import type { MediaLinkFormat, R2MediaConfig } from "@wuppycms/shared";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import * as api from "@/lib/admin/api";
import { saveSiteConfig, showOverview } from "@/lib/admin/actions";
import { $scan, $sites, $site, currentSiteEntry } from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { Icon } from "../parts";

const LINK_OPTIONS: { value: MediaLinkFormat; labelKey: string; sample: string }[] = [
	{ value: "relative", labelKey: "config.linkRelative", sample: "/blog/kapak.webp" },
	{ value: "full", labelKey: "config.linkFull", sample: "https://site.com/blog/kapak.webp" },
	{ value: "folder", labelKey: "config.linkFolder", sample: "blog/kapak.webp" },
	{ value: "media-uri", labelKey: "config.linkMediaUri", sample: "media://public/blog/kapak.webp" },
];

const SELECT_CLS =
	"border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 shrink-0 appearance-none rounded-lg border bg-background px-2 text-xs outline-none focus-visible:ring-3";

/** Ayar bölümü — bileşen dışında tanımlı: her render'da yeniden yaratılırsa
 *  içindeki input'lar remount olur ve odak kaybolur. */
function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
			<h3 className="text-sm font-semibold">{title}</h3>
			{hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
			<div className="mt-3 grid gap-3">{children}</div>
		</section>
	);
}

export default function SiteConfigView() {
	useStore($sites);
	const activeRepo = useStore($site);
	const [url, setUrl] = useState(() => currentSiteEntry()?.url ?? $scan.get()?.siteUrl ?? "");
	const [media, setMedia] = useState(() => currentSiteEntry()?.media ?? $scan.get()?.media ?? "public");
	const [mediaLink, setMediaLink] = useState<MediaLinkFormat>(() => currentSiteEntry()?.mediaLink ?? "relative");
	const [r2, setR2] = useState<R2MediaConfig | undefined>(() => currentSiteEntry()?.mediaR2);
	const [publishing, setPublishing] = useState<"review" | "immediate">(
		() => currentSiteEntry()?.publishing ?? "immediate",
	);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const branch = $sites.get().find((s) => s.repoFullName === activeRepo)?.branch ?? "";
	const projectId = $sites.get().find((s) => s.repoFullName === activeRepo)?.id ?? "";

	// --- Üyeler ---------------------------------------------------------------
	const [team, setTeam] = useState<Awaited<ReturnType<typeof api.getTeam>> | null>(null);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
	const [teamNote, setTeamNote] = useState("");
	const [teamBusy, setTeamBusy] = useState(false);

	const loadTeam = async () => {
		if (!projectId) return;
		try {
			setTeam(await api.getTeam(projectId));
		} catch {
			setTeam(null);
		}
	};
	useEffect(() => {
		void loadTeam();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- proje değişince tazele
	}, [projectId]);

	const invite = async () => {
		if (!projectId || !inviteEmail.trim() || teamBusy) return;
		setTeamBusy(true);
		setTeamNote("");
		try {
			const result = await api.inviteMember(projectId, inviteEmail.trim(), inviteRole);
			const inviteUrl = `${location.origin}${result.invitePath}`;
			setTeamNote(t("config.inviteCopied", { url: inviteUrl }));
			void navigator.clipboard?.writeText(inviteUrl).catch(() => undefined);
			setInviteEmail("");
			await loadTeam();
		} catch (err) {
			setTeamNote(err instanceof Error ? err.message : t("config.inviteFailed"));
		} finally {
			setTeamBusy(false);
		}
	};

	const copyInvite = (invitePath: string) => {
		const inviteUrl = `${location.origin}${invitePath}`;
		void navigator.clipboard?.writeText(inviteUrl).catch(() => undefined);
		setTeamNote(t("config.inviteCopied", { url: inviteUrl }));
	};

	const save = async () => {
		setBusy(true);
		setError("");
		try {
			await saveSiteConfig({
				url: url.trim(),
				media: media.trim().replace(/^\/+|\/+$/g, "") || "public",
				mediaLink,
				mediaR2: r2
					? {
							prefix: r2.prefix?.trim().replace(/^\/+|\/+$/g, "") || undefined,
							publicBaseUrl: r2.publicBaseUrl?.trim().replace(/\/+$/, "") || undefined,
						}
					: undefined,
				publishing,
			});
			showOverview();
		} catch (err) {
			setError(err instanceof Error ? err.message : t("config.saveFailed"));
		} finally {
			setBusy(false);
		}
	};

	const pubButton = (value: "review" | "immediate", label: string) => (
		<button
			type="button"
			onClick={() => setPublishing(value)}
			className={`flex-1 rounded-lg border p-2 text-left text-xs transition-colors ${
				publishing === value ? "border-2 border-primary" : "border-border hover:bg-accent/40"
			}`}
		>
			{label}
		</button>
	);

	return (
		<div className="mx-auto w-full max-w-3xl p-6" data-testid="settings-page">
			<div className="mb-5 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={() => showOverview()}
					className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title={t("config.back")}
					aria-label={t("config.back")}
				>
					<Icon name="chevron-right" className="size-4 rotate-180" />
				</button>
				<div className="min-w-0">
					<h2 className="text-lg font-semibold">{t("config.title")}</h2>
					<p className="truncate text-xs text-muted-foreground">
						{activeRepo} · {branch}
					</p>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Button variant="secondary" size="sm" data-testid="settings-discard" onClick={() => showOverview()}>
						{t("common.cancel")}
					</Button>
					<Button size="sm" data-testid="settings-save" disabled={busy} onClick={() => void save()}>
						{t("common.save")}
					</Button>
				</div>
			</div>

			<div className="grid gap-4">
				<Section title={t("config.generalTitle")}>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium" htmlFor="site-url">
							{t("config.websiteUrl")}
						</label>
						<Input
							id="site-url"
							placeholder="https://example.com"
							spellCheck={false}
							value={url}
							onChange={(event) => setUrl(event.target.value)}
						/>
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium" htmlFor="site-media">
							{t("config.mediaFolder")}
						</label>
						<Input
							id="site-media"
							placeholder="public"
							spellCheck={false}
							value={media}
							onChange={(event) => setMedia(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Astro <code className="rounded bg-muted px-1 font-mono">public/</code> klasörünü servis eder;
							varsayılanı değiştirmeyin.
						</p>
					</div>
				</Section>

				<Section title={t("config.linkFormat")} hint={t("config.linkHint")}>
					<div className="flex flex-wrap gap-2">
						{LINK_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => setMediaLink(option.value)}
								className={`min-w-[9rem] flex-1 rounded-lg border p-2 text-left text-xs transition-colors ${
									mediaLink === option.value ? "border-2 border-primary" : "border-border hover:bg-accent/40"
								}`}
							>
								<span className="block font-medium">{t(option.labelKey)}</span>
								<span className="block truncate font-mono text-[10px] text-muted-foreground">
									{option.sample}
								</span>
							</button>
						))}
					</div>
					<label className="flex items-center gap-2 text-xs font-medium">
						<input
							type="checkbox"
							className="size-4 accent-primary"
							checked={Boolean(r2)}
							onChange={(event) => setR2(event.target.checked ? (r2 ?? {}) : undefined)}
						/>
						{t("config.r2Library")}
					</label>
					{r2 ? (
						<div className="grid gap-2 rounded-lg border border-border p-3">
							<div className="grid gap-1.5">
								<label className="text-xs text-muted-foreground" htmlFor="r2-prefix">
									{t("config.r2Prefix")}
								</label>
								<Input
									id="r2-prefix"
									size="sm"
									placeholder="assets"
									spellCheck={false}
									value={r2.prefix ?? ""}
									onChange={(event) => setR2({ ...r2, prefix: event.target.value })}
								/>
							</div>
							<div className="grid gap-1.5">
								<label className="text-xs text-muted-foreground" htmlFor="r2-base">
									{t("config.r2PublicBase")}
								</label>
								<Input
									id="r2-base"
									size="sm"
									placeholder="https://assets.example.com"
									spellCheck={false}
									value={r2.publicBaseUrl ?? ""}
									onChange={(event) => setR2({ ...r2, publicBaseUrl: event.target.value })}
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								Kimlik gerekmez — WuppyCMS worker'ının bağlı kovası kullanılır. Yayın için kovaya özel alan
								bağlayın; boş bırakırsanız önizleme bizim akış uçumuzdan yapılır.
							</p>
						</div>
					) : null}
				</Section>

				<Section title={t("config.publishMode")} hint={t("config.publishHint")}>
					<div className="flex gap-2">
						{pubButton("review", t("config.publishReview"))}
						{pubButton("immediate", t("config.publishImmediate"))}
					</div>
				</Section>

				<Section title={t("config.members")}>
					{team ? (
						<div className="grid gap-2 text-xs">
							<div className="flex items-center justify-between gap-2">
								<span className="min-w-0">
									<span className="block truncate font-medium">{team.owner.name || "—"}</span>
									<span className="block truncate text-[11px] text-muted-foreground">
										{team.owner.email}
									</span>
								</span>
								<span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
									{t("config.owner")}
								</span>
							</div>
							{team.members.map((member) => (
								<div key={member.userId} className="flex items-center justify-between gap-2">
									<span className="min-w-0">
										<span className="block truncate font-medium">{member.name || member.email}</span>
										<span className="block truncate text-[11px] text-muted-foreground">
											{member.email}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-1">
										<span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
											{member.role === "viewer" ? t("config.roleViewer") : t("config.roleEditor")}
										</span>
										{team.role === "owner" ? (
											<button
												type="button"
												className="text-[11px] text-destructive hover:underline"
												onClick={() => void api.removeMember(projectId, member.userId).then(loadTeam)}
											>
												{t("config.remove")}
											</button>
										) : null}
									</span>
								</div>
							))}
							{team.invitations.map((invitation) => (
								<div key={invitation.id} className="flex items-center justify-between gap-2">
									<span className="min-w-0 truncate text-muted-foreground">
										{invitation.email} · davet bekliyor
									</span>
									<span className="flex shrink-0 items-center gap-2">
										<button
											type="button"
											className="text-[11px] text-muted-foreground hover:text-foreground"
											onClick={() => copyInvite(invitation.invitePath)}
										>
											{t("config.linkCopy")}
										</button>
										{team.role === "owner" ? (
											<button
												type="button"
												className="text-[11px] text-destructive hover:underline"
												onClick={() =>
													void api.revokeInvitation(projectId, invitation.id).then(loadTeam)
												}
											>
												{t("config.revoke")}
											</button>
										) : null}
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="text-[11px] text-muted-foreground">{t("config.membersLoadFailed")}</p>
					)}
					{team?.role === "owner" ? (
						<div className="flex flex-wrap items-center gap-1.5">
							<Input
								size="sm"
								className="min-w-[12rem] flex-1"
								aria-label="Davet e-postası"
								placeholder="ekip@ornek.com"
								value={inviteEmail}
								onChange={(event) => setInviteEmail(event.target.value)}
							/>
							<select
								aria-label="Davet rolü"
								className={SELECT_CLS}
								value={inviteRole}
								onChange={(event) => setInviteRole(event.target.value === "viewer" ? "viewer" : "editor")}
							>
								<option value="editor">{t("config.roleEditorOption")}</option>
								<option value="viewer">{t("config.roleViewerOption")}</option>
							</select>
							<Button size="sm" className="h-8 shrink-0 px-2 text-xs" disabled={teamBusy} onClick={() => void invite()}>
								{t("config.invite")}
							</Button>
						</div>
					) : null}
					{teamNote ? <p className="break-all text-[11px] text-muted-foreground">{teamNote}</p> : null}
					<p className="text-[11px] text-muted-foreground/70">
						Davet bağlantısını üyeye gönderin; kendi hesabıyla giriş yapıp kabul eder. Üyeler kendi GitHub
						bağlantılarıyla çalışır (repoya erişimi olan bir hesapla).
					</p>
				</Section>

				<div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
					Dal: <span className="font-mono">{branch}</span> · Frontmatter:{" "}
					<span className="font-mono">YAML</span> · Config v1
				</div>

				{error ? <p className="text-sm text-destructive">{error}</p> : null}
			</div>
		</div>
	);
}
