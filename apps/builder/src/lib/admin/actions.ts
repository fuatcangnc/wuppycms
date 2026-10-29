// Admin iş mantığı — depoları değiştiren tek yer. React bileşenleri yalnız
// burayı çağırır; DOM'a dokunmaz. Her işlem repoda gerçek bir commit'tir.

import * as api from "./api";
import type { RepoSummary, SiteEntry } from "./api";
import type { GitFile } from "@wuppycms/shared";
import { takeBoot, takePrefetch } from "./boot";
import { clearDraftBackup } from "./draft-backup";
import { displayToRaw, parseDoc, rawToDisplay, serializeDoc } from "./frontmatter";
import { buildControls } from "./form";
import { goTo, setApplying } from "./navigate";
import { queryClient } from "./queryClient";
import { parseResearchNotes, researchPathFor, serializeResearchNotes } from "./research";
import { resolveSiteCode } from "./url";
import {
	$body,
	$booted,
	$collection,
	$collections,
	$commits,
	$commitsLoading,
	$configFound,
	$contentmd,
	$dirty,
	$doc,
	$entries,
	$entriesView,
	$pageDirty,
	$pagePath,
	$pages,
	$error,
	$formValues,
	$scan,
	$sites,
	$site,
	$status,
	$user,
	$view,
	clearError,
	confirmDiscard,
	currentCollection,
	currentSite,
	currentSiteEntry,
	showError,
	type Site,
} from "./store";

/** Repo başına son tarama; overview/ayarlara hızlı erişim için. */
export const scanCache = new Map<string, api.ScanResult>();

function fail(message: string): never {
	$status.set("error");
	$error.set(message);
	throw new Error(message);
}

export function setFormValue(name: string, value: string): void {
	$formValues.set({ ...$formValues.get(), [name]: value });
	$dirty.set(true);
}

/**
 * Şemada olmayan bir anahtarı da yazılabilir kılarak alanı ayarlar.
 * `status` gibi CMS-meta alanları çipten/panelden gelir; dosyada henüz yoksa
 * sıraya eklenir ki kayıtta frontmatter'a yazılsın.
 */
export function setDocField(name: string, display: string): void {
	const doc = $doc.get();
	if (!doc) return;
	if (!doc.order.includes(name)) {
		doc.order.push(name);
		doc.values.set(name, display);
	}
	setFormValue(name, display);
}

// --- açılış / siteler ---------------------------------------------------------------

async function toSites(): Promise<Site[]> {
	const data = await api.listProjects();
	return data.projects.map((p) => ({
		id: p.id,
		name: p.name,
		repoFullName: p.repo_full_name,
		branch: p.default_branch,
	}));
}

export async function refreshProjects(): Promise<void> {
	try {
		// Query istemcisi üzerinden: eşzamanlı çağrılar tek isteğe iner.
		$sites.set(
			await queryClient.fetchQuery({ queryKey: ["projects"], queryFn: toSites, staleTime: 0 }),
		);
	} catch {
		$sites.set([]);
	}
}

export async function bootstrap(): Promise<void> {
	try {
		// SSR tohumu varsa oturum + proje listesi ağa çıkmadan dolar;
		// sonraki site çözümü aynı mantıkla çalışır.
		const boot = takeBoot();
		if (boot) {
			$user.set(boot.user);
			$sites.set(boot.sites);
		} else {
			const user = await api.getSessionUser();
			$user.set(user ? { name: user.name || user.email, email: user.email } : null);
			await refreshProjects();
		}

		const params = new URLSearchParams(location.search);
		const stored = localStorage.getItem("wuppycms:site") ?? "";
		const known = (repo: string) => $sites.get().some((s) => s.repoFullName === repo);
		const requestedRaw =
			params.get("site") ?? params.get("repo") ?? (known(stored) ? stored : "");
		// ?site= kısa proje kimliği olabilir; repo adına çözülmeden scan'a gitmez.
		const requested = resolveSiteCode(requestedRaw, $sites.get());
		const resolved = requested || $sites.get()[0]?.repoFullName || "";

		if (!resolved) {
			$view.set("empty");
			return;
		}
		await selectSite(resolved);
	} finally {
		// RouteApplier artık adresi uygulayabilir; açılıştaki geçiş adresleri
		// geçmişe yazılmaz (eski replaceState kapısının karşılığı).
		$booted.set(true);
		setApplying(false);
	}
}

export async function selectSite(fullName: string): Promise<void> {
	if (fullName !== $site.get() && !confirmDiscard()) return;
	clearError();
	$site.set(fullName);
	localStorage.setItem("wuppycms:site", fullName);
	$doc.set(null);
	$dirty.set(false);
	$pageDirty.set(false);
	$pagePath.set("");
	$pages.set([]);
	$collection.set("");
	$view.set("hint");
	$status.set("loading");
	try {
		// SSR bu siteyi zaten taradıysa tekrar tarama.
		const scan = takePrefetch<api.ScanResult>(`scan:${fullName}`) ?? (await api.scanSite(fullName));
		scanCache.set(fullName, scan);
		$scan.set(scan);
		$configFound.set(scan.configFound);
		$collections.set(scan.collections);
		void api
			.listPages(fullName, scan.ref)
			.then((data) => $pages.set(data.pages))
			.catch(() => $pages.set([]));
		if (!scan.configFound) {
			showError(
				"Bu repoda src/content.config.ts bulunamadı — WuppyCMS şablonu olmayan bir repo bağladınız. Kurulumu ajanınıza yaptırabilir ('Ajan ile kullan') ya da site-template'ı kopyalayabilirsiniz.",
			);
		}
		showOverview();
		const wanted = new URLSearchParams(location.search).get("collection");
		const target = wanted ? scan.collections.find((c) => c.key === wanted) : undefined;
		if (target) await openCollection(target.key);
	} catch (error) {
		showError(error instanceof Error ? error.message : "Site taranamadı.");
	}
}

/**
 * Koleksiyon listesini yeniden tarar (Add Collection sonrası) — görünümü
 * sıfırlamaz; yalnız $scan/$collections tazelenir.
 */
export async function refreshCollections(): Promise<void> {
	const site = currentSite();
	if (!site) return;
	try {
		const scan = await api.scanSite(site.repoFullName);
		scanCache.set(site.repoFullName, scan);
		$scan.set(scan);
		$configFound.set(scan.configFound);
		$collections.set(scan.collections);
	} catch {
		/* tarama hatası sessiz — kullanıcı elle yenileyebilir */
	}
}

export function showOverview(): void {
	$view.set("overview");
	goTo({ view: "overview", docPath: undefined });
	const site = currentSite();
	if (site) void loadCommits(site.repoFullName);
}

async function loadCommits(fullName: string): Promise<void> {
	const seeded = takePrefetch<api.CommitInfo[]>(`commits:${fullName}`);
	if (seeded) {
		$commits.set(seeded);
		return;
	}
	$commitsLoading.set(true);
	try {
		const { commits } = await api.listCommits(fullName, { perPage: 8 });
		$commits.set(commits);
	} catch {
		$commits.set([]);
	} finally {
		$commitsLoading.set(false);
	}
}

// --- koleksiyon / doküman listesi ------------------------------------------------------

export async function openCollection(key: string): Promise<void> {
	const site = currentSite();
	if (!site || !confirmDiscard()) return;
	clearError();
	$collection.set(key);
	$view.set("entries");
	goTo({ view: "entries", collection: key, docPath: undefined });
	$entries.set([]);
	$status.set("loading");
	const seeded = takePrefetch<{ rows: api.EntryRow[]; truncated: boolean }>(
		`entries:${site.repoFullName}|${key}`,
	);
	if (seeded) {
		$entries.set(seeded.rows);
		if (seeded.truncated) showError("Klasörde çok fazla dosya var — ilk 80 tanesi listelendi.");
		$status.set("idle");
		return;
	}
	try {
		const data = await api.getEntries(site.repoFullName, key);
		$entries.set(data.entries);
		if (data.truncated) showError("Klasörde çok fazla dosya var — ilk 80 tanesi listelendi.");
		$status.set("idle");
	} catch (error) {
		showError(error instanceof Error ? error.message : "Dokümanlar yüklenemedi.");
	}
}

export async function refreshEntries(): Promise<void> {
	const site = currentSite();
	if (!site || !$collection.get()) return;
	try {
		const data = await api.getEntries(site.repoFullName, $collection.get());
		$entries.set(data.entries);
	} catch {
		// liste tazeleme kritik değil
	}
}

// --- doküman editörü ---------------------------------------------------------------------

export async function openDoc(path: string): Promise<void> {
	const site = currentSite();
	if (!site || !confirmDiscard()) return;
	clearError();
	$status.set("loading");
	try {
		const file =
			takePrefetch<GitFile>(`doc:${site.repoFullName}|${path}`) ??
			(await api.getFile(site.repoFullName, path));
		const parsed = parseDoc(file.content);
		const doc = {
			path,
			collectionKey: $collection.get(),
			order: parsed.order,
			values: parsed.values,
			body: parsed.body,
			baseSha: file.sha,
		};
		$doc.set(doc);
		const controls = buildControls(currentCollection(), doc);
		const values: Record<string, string> = {};
		for (const control of controls) {
			values[control.name] = rawToDisplay(doc.values.get(control.name), control.type);
		}
		$formValues.set(values);
		$body.set(doc.body);
		$dirty.set(false);
		$status.set("idle");
		$view.set("doc");
		goTo({ view: "doc", collection: doc.collectionKey, docPath: doc.path });
	} catch (error) {
		showError(error instanceof Error ? error.message : "Dosya okunamadı.");
	}
}

/**
 * Editör durumunu dosya metnine çevirip verilen mesajla commit'ler; başarıda
 * doc'u tazeler, kirli bayrağını indirir ve taslak yedeğini süpürür.
 * saveDoc (Kaydet) ve takeSnapshot (Anlık görüntü) aynı yolu kullanır.
 */
async function commitDoc(message: string): Promise<void> {
	const site = currentSite();
	const doc = $doc.get();
	if (!site || !doc) return;

	const controls = buildControls(currentCollection(), doc);
	const values = $formValues.get();
	for (const control of controls) {
		const display = values[control.name] ?? "";
		const exists = doc.values.has(control.name);
		if (!exists && display.trim() === "") continue;
		doc.values.set(control.name, displayToRaw(display, control.type));
		if (!exists) doc.order.push(control.name);
	}

	const lines = doc.order
		.filter((key, i) => doc.order.indexOf(key) === i)
		.map((key) => `${key}: ${doc.values.get(key) ?? ""}`);
	const fileText = lines.length
		? `---\n${lines.join("\n")}\n---\n${$body.get()}`
		: $body.get();

	await api.commitFiles(site.repoFullName, site.branch, message, [{ path: doc.path, content: fileText }]);
	const parsed = parseDoc(fileText);
	doc.order = parsed.order;
	doc.values = parsed.values;
	doc.body = $body.get();
	$dirty.set(false);
	void clearDraftBackup(site.repoFullName, doc.path); // yedek artık gereksiz
}

export async function saveDoc(): Promise<void> {
	const site = currentSite();
	const doc = $doc.get();
	if (!site || !doc) return;
	clearError();
	$status.set("saving");
	try {
		const slug = (doc.path.split("/").pop() ?? doc.path).replace(/\.\w+$/, "");
		await commitDoc(`cms: ${slug} güncellendi (via WuppyCMS)`);
		$status.set("saved");
		void refreshEntries();
	} catch (error) {
		showError(error instanceof Error ? error.message : "Kaydedilemedi.");
	}
}

/**
 * P2 — Anlık görüntü: mevcut durumu etiketli commit olarak saklar (sürüm
 * işareti). Değişiklik yoksa git'e boş commit atılmaz; çağıran uyarır.
 */
export async function takeSnapshot(): Promise<boolean> {
	const site = currentSite();
	const doc = $doc.get();
	if (!site || !doc) return false;
	if (!$dirty.get()) return false;
	clearError();
	$status.set("saving");
	try {
		const slug = (doc.path.split("/").pop() ?? doc.path).replace(/\.\w+$/, "");
		await commitDoc(`cms: ${slug} anlık görüntü (via WuppyCMS)`);
		$status.set("saved");
		void refreshEntries();
		void queryClient.invalidateQueries({ queryKey: ["docCommits"] });
		return true;
	} catch (error) {
		showError(error instanceof Error ? error.message : "Anlık görüntü alınamadı.");
		return false;
	}
}

/**
 * P2 — Geçmiş sürümü forma yükler (kaydetmez; kirli işaretler).
 * Kullanıcı gözden geçirip Kaydet'e basar — geri dönüş de normal bir commit.
 */
export function loadDocText(raw: string): void {
	const doc = $doc.get();
	if (!doc) return;
	const parsed = parseDoc(raw);
	const nextDoc = { ...doc, order: parsed.order, values: parsed.values };
	$doc.set(nextDoc);
	const values: Record<string, string> = {};
	for (const control of buildControls(currentCollection(), nextDoc)) {
		values[control.name] = rawToDisplay(nextDoc.values.get(control.name), control.type);
	}
	$formValues.set(values);
	$body.set(parsed.body);
	$dirty.set(true);
}

// --- Araştırma notları (Wryte "Research" paritesi) ------------------------------------

/** Araştırma notlarını repo'dan okur (dosya yoksa boş liste). */
export async function loadResearchNotes(path: string): Promise<string[]> {
	const site = currentSite();
	if (!site) return [];
	try {
		const file = await api.getFile(site.repoFullName, path);
		return parseResearchNotes(file.content);
	} catch {
		return [];
	}
}

/**
 * Araştırma notlarını repo'ya commit'ler (`.wuppycms/research/…` — ADR 0006
 * repo-only yaşam döngüsü). Başarıda true döner.
 */
export async function saveResearchNotes(notes: string[]): Promise<boolean> {
	const site = currentSite();
	const doc = $doc.get();
	if (!site || !doc) return false;
	clearError();
	$status.set("saving");
	try {
		const slug = (doc.path.split("/").pop() ?? doc.path).replace(/\.\w+$/, "");
		await api.commitFiles(
			site.repoFullName,
			site.branch,
			`cms: ${slug} araştırma notları güncellendi (via WuppyCMS)`,
			[{ path: researchPathFor(doc.path), content: serializeResearchNotes(notes) }],
		);
		$status.set("saved");
		return true;
	} catch (error) {
		showError(error instanceof Error ? error.message : "Araştırma notları kaydedilemedi.");
		return false;
	}
}

// --- İnceleme akışı (parity 2b-ii) ---------------------------------------------------

/** İncelemeler görünümünü açar. */
export function openReviews(): void {
	$view.set("review");
	goTo({ view: "review" });
}

/**
 * "İncelemeye gönder": mevcut editör durumunu review/<slug> dalına commit eder
 * ve PR açar — ANA DAL DEĞİŞMEZ. Kaydet'in serileştirmesiyle aynı metin gider.
 */
export async function startDocReview(): Promise<void> {
	const site = currentSite();
	const doc = $doc.get();
	if (!site || !doc) return;
	clearError();
	$status.set("saving");
	try {
		const controls = buildControls(currentCollection(), doc);
		const values = $formValues.get();
		for (const control of controls) {
			const display = values[control.name] ?? "";
			const exists = doc.values.has(control.name);
			if (!exists && display.trim() === "") continue;
			doc.values.set(control.name, displayToRaw(display, control.type));
			if (!exists) doc.order.push(control.name);
		}
		const lines = doc.order
			.filter((key, i) => doc.order.indexOf(key) === i)
			.map((key) => `${key}: ${doc.values.get(key) ?? ""}`);
		const fileText = lines.length ? `---\n${lines.join("\n")}\n---\n${$body.get()}` : $body.get();
		const slug = (doc.path.split("/").pop() ?? doc.path).replace(/\.\w+$/, "");
		await api.startReview(site.repoFullName, {
			path: doc.path,
			content: fileText,
			title: `İnceleme: ${slug}`,
			body: `“${doc.path}” için inceleme talebi — onaylanınca birleştirin (WuppyCMS).`,
		});
		$status.set("saved");
		openReviews();
	} catch (error) {
		$status.set("idle");
		showError(error instanceof Error ? error.message : "İncelemeye gönderilemedi.");
	}
}

/** İnceleme kararı verir ve listeyi tazeler. */
export async function decideReview(
	number: number,
	event: "APPROVE" | "REQUEST_CHANGES",
): Promise<void> {
	const site = currentSite();
	if (!site) return;
	try {
		await api.reviewDecision(site.repoFullName, number, event);
		void queryClient.invalidateQueries({ queryKey: ["reviews"] });
	} catch (error) {
		showError(error instanceof Error ? error.message : "Karar kaydedilemedi.");
	}
}

/** İncelemeyi birleştirir (içerik ana dala girer — yayın). */
export async function mergeReviewPull(number: number): Promise<void> {
	const site = currentSite();
	if (!site) return;
	try {
		await api.mergeReview(site.repoFullName, number);
		void queryClient.invalidateQueries({ queryKey: ["reviews"] });
		void refreshEntries();
	} catch (error) {
		showError(error instanceof Error ? error.message : "Birleştirilemedi.");
	}
}

/** İncelemeyi kapatır (birleştirmeden). */
export async function closeReviewPull(number: number): Promise<void> {
	const site = currentSite();
	if (!site) return;
	try {
		await api.closeReview(site.repoFullName, number);
		void queryClient.invalidateQueries({ queryKey: ["reviews"] });
	} catch (error) {
		showError(error instanceof Error ? error.message : "Kapatılamadı.");
	}
}

export async function deleteDoc(): Promise<void> {
	const site = currentSite();
	const doc = $doc.get();
	if (!site || !doc) return;
	if (!window.confirm(`“${doc.path}” çöpe taşınsın mı? (Çöp'ten geri yüklenebilir)`)) return;
	clearError();
	$status.set("saving");
	try {
		// P3 — Yumuşak silme: dosya _trash/ altına taşınır, geçmiş korunur.
		const file = await api.getFile(site.repoFullName, doc.path);
		await api.commitFiles(site.repoFullName, site.branch, `cms: ${doc.path} çöpe taşındı (via WuppyCMS)`, [
			{ path: `_trash/${doc.path}`, content: file.content },
			{ path: doc.path, delete: true },
		]);
		void clearDraftBackup(site.repoFullName, doc.path);
		$doc.set(null);
		$dirty.set(false);
		$status.set("idle");
		await openCollection($collection.get());
	} catch (error) {
		showError(error instanceof Error ? error.message : "Silinemedi.");
	}
}

// --- Astro sayfaları (src/pages) -----------------------------------------------------

/** `src/pages` dosyalarını tazeler (ajan sayfa düzenledikten sonra). */
export async function refreshPages(): Promise<void> {
	const site = currentSite();
	if (!site) return;
	try {
		const data = await api.listPages(site.repoFullName, site.branch);
		$pages.set(data.pages);
	} catch {
		/* tarama hatası sessiz */
	}
}

/** Bir Astro sayfasını kaynak editöründe açar. */
export function openPage(path: string): void {
	if (!confirmDiscard()) return;
	const rel = path.replace(/^src\/pages\//, "").replace(/^\/+/, "");
	clearError();
	$doc.set(null);
	$dirty.set(false);
	$pagePath.set(rel);
	$view.set("page");
	goTo({ view: "page", pagePath: rel });
}

// --- P3: pano / takvim / çöp ---------------------------------------------------------

/** Liste görünümü değiştirir (liste/pano/takvim) — adreste taşınır (ADR 0005). */
export function setEntriesView(view: "list" | "board" | "calendar"): void {
	$entriesView.set(view);
	goTo({ view: "entries", entriesView: view });
}

/** Site ayarlarını açar (sayfa görünümü — modal değil). */
export function openSiteSettings(): void {
	$view.set("settings");
	goTo({ view: "settings" });
}

/** Çöp görünümünü açar. */
export function openTrash(): void {
	$view.set("trash");
	goTo({ view: "trash" });
}

/** Panoda sürükle-bırak: girişin frontmatter `status` alanını değiştirir. */
export async function setEntryStatus(path: string, status: string): Promise<void> {
	const site = currentSite();
	if (!site) return;
	clearError();
	try {
		const file = await api.getFile(site.repoFullName, path);
		const parsed = parseDoc(file.content);
		if ((parsed.values.get("status") ?? "").trim() === status) return;
		const order = parsed.order.includes("status") ? parsed.order : [...parsed.order, "status"];
		const values = new Map(parsed.values);
		values.set("status", status);
		const label = status === "ready" ? "Hazır" : status === "review" ? "İnceleme" : "Taslak";
		const slug = (path.split("/").pop() ?? path).replace(/\.\w+$/, "");
		await api.commitFiles(site.repoFullName, site.branch, `cms: ${slug} durumu ${label} (via WuppyCMS)`, [
			{ path, content: serializeDoc(order, values, parsed.body) },
		]);
		await refreshEntries();
	} catch (error) {
		showError(error instanceof Error ? error.message : "Durum güncellenemedi.");
	}
}

/** Çöpteki dosyayı eski yoluna döndürür. */
export async function restoreFromTrash(trashPath: string): Promise<void> {
	const site = currentSite();
	if (!site) return;
	clearError();
	try {
		const original = trashPath.replace(/^_trash\//, "");
		const file = await api.getFile(site.repoFullName, trashPath);
		await api.commitFiles(site.repoFullName, site.branch, `cms: ${original} çöpten geri yüklendi (via WuppyCMS)`, [
			{ path: original, content: file.content },
			{ path: trashPath, delete: true },
		]);
		await refreshEntries();
	} catch (error) {
		showError(error instanceof Error ? error.message : "Geri yüklenemedi.");
	}
}

/** Çöpteki dosyayı kalıcı siler (geçmişte kalır). */
export async function destroyFromTrash(trashPath: string): Promise<void> {
	const site = currentSite();
	if (!site) return;
	if (!window.confirm(`“${trashPath.replace(/^_trash\//, "")}” kalıcı olarak silinsin mi?`)) return;
	clearError();
	try {
		const original = trashPath.replace(/^_trash\//, "");
		await api.commitFiles(site.repoFullName, site.branch, `cms: ${original} kalıcı silindi (via WuppyCMS)`, [
			{ path: trashPath, delete: true },
		]);
		await refreshEntries();
	} catch (error) {
		showError(error instanceof Error ? error.message : "Kalıcı silinemedi.");
	}
}

export async function createEntry(title: string, slug?: string): Promise<void> {
	const site = currentSite();
	const collection = currentCollection();
	if (!site || !collection) return fail("Önce bir koleksiyon aç.");
	const result = await api.createEntry(site.repoFullName, collection.key, title, slug);
	// dosya oluştu; listeyi açarken hata olursa commit boşa gitmesin → bantta göster
	await openCollection(collection.key).catch(() => undefined);
	await openDoc(result.path).catch(() => undefined);
}

// --- CONTENT.md ----------------------------------------------------------------------------

export async function openContentMd(): Promise<void> {
	const site = currentSite();
	if (!site || !confirmDiscard()) return;
	clearError();
	$view.set("contentmd");
	goTo({ view: "contentmd", collection: undefined, docPath: undefined });
	$contentmd.set({ text: "", existed: false, loading: true });
	const seeded = takePrefetch<string>(`contentmd:${site.repoFullName}`);
	if (seeded !== undefined) {
		$contentmd.set({ text: seeded, existed: true, loading: false });
		return;
	}
	try {
		const file = await api.getFile(site.repoFullName, "CONTENT.md");
		$contentmd.set({ text: file.content, existed: true, loading: false });
	} catch {
		$contentmd.set({ text: "", existed: false, loading: false });
	}
}

export async function saveContentMd(): Promise<void> {
	const site = currentSite();
	if (!site) return;
	const state = $contentmd.get();
	clearError();
	try {
		await api.commitFiles(
			site.repoFullName,
			site.branch,
			`docs: ${state.existed ? "CONTENT.md güncellendi" : "CONTENT.md eklendi"} (via WuppyCMS)`,
			[{ path: "CONTENT.md", content: state.text }],
		);
		$contentmd.set({ ...state, existed: true });
		$status.set("saved");
	} catch (error) {
		showError(error instanceof Error ? error.message : "Kaydedilemedi.");
	}
}

// --- Medya ------------------------------------------------------------------------------------
// Yükleme/listeleme/silme/bağlantı mantığı media.ts'te (kitaplık soyutlaması).
// Sidebar/Views action import yolunu kullansın diye burada yeniden dışa aktarılır.

export {
	deleteMedia,
	entryMediaScope,
	loadMoreMedia,
	mediaLinkFor,
	mediaPreviewUrl,
	openMedia,
	pickMedia,
	refreshMedia,
	resolveMediaPick,
	setMediaFolder,
	setMediaLibrary,
	uploadMedia,
} from "./media";
export { clearError, confirmDiscard, showError } from "./store";

// --- sihirbaz / ayarlar -------------------------------------------------------------------------

export function listReposCached(): Promise<RepoSummary[]> {
	// eski elle-önbellek yerine Query: tekilleşme + ortak iptal bedavaya gelir.
	return queryClient.fetchQuery({
		queryKey: ["repos"],
		queryFn: () => api.listRepos().then((data) => data.repos ?? []),
	});
}

export async function finishSetup(options: {
	repo: string;
	url: string;
	media: string;
	publishing: "review" | "immediate";
	collections: string[];
}): Promise<SiteEntry> {
	const entry: SiteEntry = {
		key: "root",
		name:
			options.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ||
			(options.repo.split("/")[1] ?? options.repo),
		url: options.url || undefined,
		media: options.media,
		publishing: options.publishing,
		collections: options.collections,
	};
	await api.createProject(options.repo);
	try {
		await api.putSiteConfig(options.repo, [entry]);
		const scan = scanCache.get(options.repo);
		if (scan) scanCache.set(options.repo, { ...scan, setup: { version: 1, sites: [entry] } });
	} catch {
		// sites.jsonc commit'i kritik değil (ör. korumalı dal); CMS çalışmaya devam eder
	}
	void queryClient.invalidateQueries({ queryKey: ["repos"] });
	await refreshProjects();
	return entry;
}

export async function saveSiteConfig(options: {
	url: string;
	media: string;
	publishing: "review" | "immediate";
	mediaLink?: SiteEntry["mediaLink"];
	mediaR2?: SiteEntry["mediaR2"];
}): Promise<void> {
	const repo = $site.get();
	if (!repo) return;
	const entry: SiteEntry = {
		key: "root",
		name:
			options.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ||
			(currentSiteEntry()?.name ?? repo.split("/")[1] ?? repo),
		url: options.url || undefined,
		media: options.media,
		mediaLink: options.mediaLink,
		mediaR2: options.mediaR2,
		publishing: options.publishing,
		collections: currentSiteEntry()?.collections,
	};
	await api.putSiteConfig(repo, [entry]);
	const scan = scanCache.get(repo) ?? $scan.get();
	if (scan) {
		const updated = { ...scan, setup: { version: 1 as const, sites: [entry] } };
		scanCache.set(repo, updated);
		$scan.set(updated);
	}
}
