// Site ekleme sihirbazı: depo seç → tara → Adım 1 → Adım 2 → hazır.
// Durum $wizard atom'unda yaşar; diyalog kapanıp açılsa da yarım kaldığı
// yerden devam eder. Sonuç: proje kaydı + repoya .wuppycms/sites.jsonc commit'i.

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui-react/dialog";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { Skeleton, SkeletonRows } from "@/components/ui-react/skeleton";
import * as api from "@/lib/admin/api";
import { finishSetup, listReposCached, selectSite } from "@/lib/admin/actions";
import { hostOf } from "@/lib/admin/format";
import { $sites, $wizard, closeDialog, openDialog, type WizardState } from "@/lib/admin/store";

const EMPTY: WizardState = {
	step: "list",
	repo: "",
	scan: null,
	url: "",
	media: "public",
	checked: [],
	publishing: "review",
};

const PUBLISH_CARD =
	"rounded-xl p-3 text-left transition-colors";

export default function SiteWizardDialog() {
	const wizard = useStore($wizard) ?? EMPTY;
	const knownSites = useStore($sites);
	const [repos, setRepos] = useState<api.RepoSummary[] | null>(null);
	const [query, setQuery] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	// Daima atom'un güncel değerinden türet — bayat closure referansı
	// (ör. scan bekleme sırasında) alan kaybına yol açar.
	const patch = (part: Partial<WizardState>) =>
		$wizard.set({ ...($wizard.get() ?? EMPTY), ...part });

	useEffect(() => {
		if (repos) return;
		void listReposCached()
			.then(setRepos)
			.catch((err) => setError(err instanceof Error ? err.message : "Depolar alınamadı."));
	}, [repos]);

	const startScan = async (fullName: string) => {
		setError("");
		patch({ step: "scan", repo: fullName });
		try {
			const scan = await api.scanSite(fullName);
			if (!scan.configFound) {
				patch({ step: "list" });
				setError(
					`${fullName} içinde src/content.config.ts bulunamadı — Astro içerik koleksiyonu olmayan bir repo. Şablonu kopyalayıp içindekini kurabilirsin.`,
				);
				return;
			}
			patch({
				step: "step1",
				scan,
				url: scan.siteUrl ?? "",
				media: scan.media ?? "public",
				checked: scan.collections.map((c) => c.key),
			});
		} catch (err) {
			patch({ step: "list" });
			setError(err instanceof Error ? err.message : t("wizard.errorScan"));
		}
	};

	const next = async () => {
		if (wizard.step === "step1") {
			if (wizard.checked.length === 0) {
				setError(t("wizard.errorPickCollection"));
				return;
			}
			setError("");
			patch({ step: "step2" });
		} else if (wizard.step === "step2") {
			setBusy(true);
			setError("");
			try {
				await finishSetup({
					repo: wizard.repo,
					url: wizard.url.trim(),
					media: wizard.media.trim().replace(/^\/+|\/+$/g, "") || "public",
					publishing: wizard.publishing,
					collections: wizard.checked,
				});
				patch({ step: "ready" });
			} catch (err) {
				patch({ step: "step1" });
				setError(err instanceof Error ? err.message : t("wizard.errorSetup"));
			} finally {
				setBusy(false);
			}
		}
	};

	const close = () => {
		closeDialog("site");
		$wizard.set(null);
	};

	const scan = wizard.scan;
	const known = new Set(knownSites.map((s) => s.repoFullName));
	const q = query.trim().toLowerCase();
	const matched = (repos ?? []).filter(
		(r) => (!q || r.fullName.toLowerCase().includes(q)) && !known.has(r.fullName),
	);
	const checkedCount = wizard.checked.length;
	const summaryUrl = hostOf(wizard.url) || wizard.repo;
	const mediaClean = wizard.media.trim().replace(/^\/+|\/+$/g, "") || "public";

	return (
		<Dialog open onClose={close}>
			<DialogOverlay onPointerDown={close} />
			<DialogContent showCloseButton={false} className="sm:max-w-3xl gap-0 p-0">
			<div className="flex w-full overflow-hidden rounded-xl">
				<div className="flex min-h-[420px] min-w-0 flex-1 flex-col border-r border-border">
					{wizard.step === "list" && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="p-5 pb-3">
								<h3 className="text-sm font-semibold">{t("wizard.title")}</h3>
								<p className="mt-1 text-xs text-muted-foreground">
									Siteni barındıran depoyu seç; WuppyCMS repodaki her siteyi bulur.
								</p>
								<Input
									placeholder={t("wizard.repoSearch")}
									size="sm"
									className="mt-3"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
								/>
							</div>
							<div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
								{!repos && <SkeletonRows rows={6} className="px-0" />}
								{repos &&
									matched.slice(0, 100).map((repo) => (
										<button
											key={repo.fullName}
											type="button"
											onClick={() => void startScan(repo.fullName)}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
										>
											<span className="shrink-0 text-muted-foreground">⌥</span>
											<span className="min-w-0 flex-1 truncate text-sm">
												<span className="text-muted-foreground">{repo.fullName.split("/")[0]}/</span>
												<span className="font-medium">{repo.fullName.split("/")[1]}</span>
											</span>
											<span className="shrink-0 text-xs text-muted-foreground">
												{repo.private ? "🔒 kurulum yok" : "kurulum yok"}
											</span>
											<span className="shrink-0 text-muted-foreground">›</span>
										</button>
									))}
								{repos && matched.length === 0 && (
									<p className="px-3 py-2 text-sm text-muted-foreground">{t("wizard.noMatch")}</p>
								)}
							</div>
							{error && <p className="px-5 pb-3 text-sm text-destructive">{error}</p>}
							<div className="border-t border-border p-4">
								<p className="text-xs text-muted-foreground">
									Deponu görmüyor musun? GitHub oturumunun depo erişimini kontrol et.
								</p>
							</div>
						</div>
					)}

					{wizard.step === "scan" && (
						<div className="flex min-h-0 flex-1 flex-col p-5">
							<h3 className="text-sm font-semibold">{t("wizard.reading")}</h3>
							<p className="mt-1 text-xs text-muted-foreground">{t("wizard.readingBody", { repo: wizard.repo })}</p>
							<div className="mt-6 space-y-3">
								<Skeleton className="h-2.5 w-28" />
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-2.5 w-36" />
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-2.5 w-24" />
								<Skeleton className="h-9 w-full" />
							</div>
						</div>
					)}

					{wizard.step === "step1" && scan && (
						<div className="min-h-0 flex-1 overflow-y-auto p-5">
							<p className="text-xs text-muted-foreground">{t("wizard.step1of2")}</p>
							<h3 className="mt-0.5 text-sm font-semibold">{t("wizard.step1Title")}</h3>
							<p className="mt-1 text-xs text-muted-foreground">{t("wizard.step1Body")}</p>
							<div className="mt-4 grid gap-4">
								<div className="grid gap-1.5">
									<label className="text-xs font-medium">{t("wizard.siteUrl")}</label>
									<Input value={wizard.url} onChange={(event) => patch({ url: event.target.value })} placeholder="example.com" />
									<p className="text-xs text-muted-foreground">{t("wizard.siteUrlHint")}</p>
								</div>
								<div>
									<p className="text-xs font-medium">{t("wizard.content")}</p>
									<p className="mb-2 text-xs text-muted-foreground">
										Koleksiyonlar bulundu. Editörlerin değiştirmemesi gerekenlerin işaretini kaldır.
									</p>
									<div className="grid gap-1.5">
										{scan.collections.length === 0 && (
											<p className="text-xs text-destructive">{t("wizard.noCollectionsScan")}</p>
										)}
										{scan.collections.map((collection) => (
											<label key={collection.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
												<input
													type="checkbox"
													className="size-4 accent-primary"
													checked={wizard.checked.includes(collection.key)}
													onChange={(event) =>
														patch({
															checked: event.target.checked
																? [...wizard.checked, collection.key]
																: wizard.checked.filter((k) => k !== collection.key),
														})
													}
												/>
												<span className="min-w-0">
													<span className="block truncate text-sm font-medium">{collection.name}</span>
													<span className="block truncate text-xs text-muted-foreground">
														{collection.entryCount} kayıt · {collection.base}
													</span>
												</span>
											</label>
										))}
									</div>
								</div>
								<div className="grid gap-1.5">
									<label className="text-xs font-medium">{t("config.mediaFolder")}</label>
									<Input value={wizard.media} spellCheck={false} onChange={(event) => patch({ media: event.target.value })} placeholder="public" />
									<p className="text-xs text-muted-foreground">
										Yüklenen görseller buraya gider; bağlantılar <code className="font-mono">/gorsel.jpg</code> olur.
									</p>
								</div>
								<button
									type="button"
									onClick={() => openDialog("ai")}
									className="rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:bg-accent/40"
								>
									<span className="text-sm font-medium">{t("wizard.withAgent")}</span>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{t("wizard.withAgentHint")}
									</p>
								</button>
								{error && <p className="text-sm text-destructive">{error}</p>}
							</div>
						</div>
					)}

					{wizard.step === "step2" && (
						<div className="min-h-0 flex-1 overflow-y-auto p-5">
							<p className="text-xs text-muted-foreground">{t("wizard.step2of2")}</p>
							<h3 className="mt-0.5 text-sm font-semibold">{t("wizard.step2Title")}</h3>
							<p className="mt-1 text-xs text-muted-foreground">{t("wizard.step2Body")}</p>
							<div className="mt-4 grid gap-2 sm:grid-cols-2">
								<button
									type="button"
									onClick={() => patch({ publishing: "review" })}
									className={`${PUBLISH_CARD} ${wizard.publishing === "review" ? "border-2 border-primary" : "border border-border hover:border-muted-foreground/40"}`}
								>
									<span className="text-sm font-medium">{t("wizard.reviewFirst")}</span>
									<p className="mt-1 text-xs text-muted-foreground">{t("wizard.reviewModeHint")}</p>
								</button>
								<button
									type="button"
									onClick={() => patch({ publishing: "immediate" })}
									className={`${PUBLISH_CARD} ${wizard.publishing === "immediate" ? "border-2 border-primary" : "border border-border hover:border-muted-foreground/40"}`}
								>
									<span className="text-sm font-medium">{t("config.publishImmediate")}</span>
									<p className="mt-1 text-xs text-muted-foreground">{t("wizard.immediateModeHint")}</p>
								</button>
							</div>
							<div className="mt-4 rounded-lg border border-border p-3">
								<p className="text-xs font-medium">{t("wizard.siteSection")}</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{summaryUrl} · {checkedCount} koleksiyon · medya /{mediaClean}/
								</p>
							</div>
							{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
						</div>
					)}

					{wizard.step === "ready" && (
						<div className="flex min-h-0 flex-1 flex-col p-5">
							<h3 className="text-sm font-semibold">{t("wizard.done")}</h3>
							<p className="mt-1 text-xs text-muted-foreground">{t("wizard.doneBody")}</p>
							<div className="mt-4 rounded-xl border border-border p-4">
								<p className="flex items-center gap-2 text-sm font-medium">
									<span className="text-emerald-500">✓</span>
									<span>{hostOf(wizard.url) || wizard.repo.split("/")[1] || wizard.repo}</span>
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{wizard.repo} · {checkedCount} koleksiyon · medya /{mediaClean}/
								</p>
							</div>
							<div className="mt-auto flex justify-end gap-2 pt-4">
								<Button variant="outline" size="sm" disabled title={t("wizard.soon")}>{t("wizard.inviteEditor")}</Button>
								<Button
									size="sm"
									onClick={() => {
										const repo = wizard.repo;
										close();
										void selectSite(repo);
									}}
								>
									Aç
								</Button>
							</div>
						</div>
					)}

					{wizard.step !== "ready" && wizard.step !== "scan" && (
						<div className="flex items-center justify-between border-t border-border p-4">
							<button
								type="button"
								onClick={() => patch({ step: wizard.step === "step2" ? "step1" : "list" })}
								className={wizard.step === "step1" || wizard.step === "step2" ? "text-sm text-muted-foreground transition-colors hover:text-foreground" : "invisible"}
							>
								← Geri
							</button>
							<span />
							<Button size="sm" disabled={wizard.step === "list" || busy} onClick={() => void next()}>
								{busy ? t("wizard.creating") : wizard.step === "step2" ? t("wizard.createSite") : t("wizard.next")}
							</Button>
						</div>
					)}
				</div>

				{/* Sağ panel */}
				<div className="hidden w-72 shrink-0 bg-muted/20 p-5 md:block">
					{(wizard.step === "list" || wizard.step === "scan" || wizard.step === "ready") && (
						<div>
							<p className="text-sm font-semibold">{t("wizard.repoTruth")}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								WuppyCMS repoyu doğrudan okur-yazar. Senkron tutulacak içerik kopyası yoktur.
							</p>
							<div className="mt-4 space-y-1 text-xs">
								<div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
									<span className="truncate font-mono">{wizard.repo || "owner/repo"}</span>
									<span className="text-muted-foreground">GitHub</span>
								</div>
								<p className="pl-1 text-muted-foreground">↓ Markdown ve MDX doğrudan okunur</p>
								<div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
									<span className="font-medium">WuppyCMS</span>
									<span className="text-muted-foreground">{t("wizard.visualEditor")}</span>
								</div>
								<p className="pl-1 text-muted-foreground">{t("wizard.everySaveCommit")}</p>
								<div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
									<span className="truncate font-medium">Yazarlar, pazarlama…</span>
									<span className="text-muted-foreground">Git bilmeden</span>
								</div>
							</div>
						</div>
					)}
					{wizard.step === "step1" && (
						<div>
							<p className="text-sm font-semibold">{t("wizard.editorPreview")}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								İşaretli her klasör sol menüde koleksiyon olur; yüklemeler medya klasörüne gider.
							</p>
							<div className="mt-4 rounded-lg border border-border bg-background p-2 text-xs">
								<p className="flex items-center gap-2 px-1 py-1 font-medium">
									<span className="inline-block size-3 rounded-sm border border-border" /> senin siten
								</p>
								<p className="mt-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">Koleksiyonlar</p>
								<div className="space-y-0.5 px-1">
									{wizard.checked.map((key) => (
										<p key={key} className="px-1 py-0.5">📄 {key.charAt(0).toUpperCase()}{key.slice(1)}</p>
									))}
								</div>
								<p className="mt-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">Site</p>
								<p className="flex items-center justify-between px-1 py-0.5 text-muted-foreground">
									<span>Medya</span>
									<span className="font-mono text-[10px]">/{mediaClean}/</span>
								</p>
							</div>
						</div>
					)}
					{wizard.step === "step2" && (
						<div>
							<p className="text-sm font-semibold">{t("wizard.reviewNothingLive")}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Taslaklar onaylanana kadar izole kalır; canlı site yalnız yayınlayınca değişir.
							</p>
							<div className="mt-4 space-y-1 text-xs">
								<div className="rounded-lg border border-border bg-background px-3 py-2">✎ Editör yazar — kendi dalında</div>
								<p className="pl-1 text-muted-foreground">↓</p>
								<div className="rounded-lg border border-border bg-background px-3 py-2">👥 İnceleyen yorumlar ve onaylar</div>
								<p className="pl-1 text-muted-foreground">↓</p>
								<div className="rounded-lg border border-border bg-background px-3 py-2">🚀 Yayınlandı — main'e merge</div>
							</div>
							<p className="mt-3 rounded-lg bg-muted/60 p-2 text-[11px] text-muted-foreground">
								Dallar ve commit'ler editöre asla görünmez; WuppyCMS halleder.
							</p>
						</div>
					)}
					<button type="button" onClick={close} className="mt-6 text-xs text-muted-foreground transition-colors hover:text-foreground">
						Kapat
					</button>
				</div>
			</div>
			</DialogContent>
		</Dialog>
	);
}
