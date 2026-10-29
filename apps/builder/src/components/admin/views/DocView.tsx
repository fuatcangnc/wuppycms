// Doküman editörü — Wryte paritesi: başlık ve durum iş akışı üst bardaki
// yuvalara portal'lanır (breadcrumb + aksiyon şeridi); içerik sütunu araç
// çubuğuyla başlar. MDX gövde mdxeditor'da; sağda Outline/Araştırma/meta
// kolonları. Alan değerleri $formValues/$body store'unda; kayıt actions.saveDoc.

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui-react/badge";
import { Button } from "@/components/ui-react/button";
import MdxBodyEditor from "@/components/admin/parts/MdxBodyEditor";
import MetaPanel from "@/components/admin/parts/MetaPanel";
import BodyOutline from "@/components/admin/parts/BodyOutline";
import ResearchPanel from "@/components/admin/parts/ResearchPanel";
import DraftTabs from "@/components/admin/parts/DraftTabs";
import AiGenerateDialog from "@/components/admin/dialogs/AiGenerateDialog";
import { Icon } from "@/components/admin/parts";
import { buildControls } from "@/lib/admin/form";
import { setDocField, setFormValue, startDocReview } from "@/lib/admin/actions";
import { clearDraftBackup, loadDraftBackup, saveDraftBackup, type DraftBackup } from "@/lib/admin/draft-backup";
import { $draftTabActive } from "@/lib/admin/draft-tabs";
import { entryMediaScope, mediaAltFor, pickMedia, uploadMedia } from "@/lib/admin/media";
import { STATUS_OPTIONS, normalizeStatus, readiness, statusLabel } from "@/lib/admin/meta";
import { $body, $dirty, $doc, $formValues, $mediaWidths, currentCollection, currentSite } from "@/lib/admin/store";

/** Durum çipi renkleri — taslak nötr, inceleme amber, hazır yeşil. */
const STATUS_CHIP_CLS: Record<"draft" | "review" | "ready", string> = {
	draft: "bg-muted text-muted-foreground",
	review: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
	ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

/** FRONTMATTER satırındaki durum noktası + etiket renkleri (Wryte: ● READY). */
const STATUS_DOT_CLS: Record<"draft" | "review" | "ready", string> = {
	draft: "bg-muted-foreground",
	review: "bg-amber-500",
	ready: "bg-emerald-500",
};
const STATUS_TEXT_CLS: Record<"draft" | "review" | "ready", string> = {
	draft: "text-muted-foreground",
	review: "text-amber-600 dark:text-amber-400",
	ready: "text-emerald-600 dark:text-emerald-400",
};

/** Araç çubuğunun sağındaki panel anahtarı (Wryte: sütun ikonları). */
function PanelToggle({
	icon,
	label,
	pane,
	active = false,
	onClick,
}: {
	icon: string;
	label: string;
	pane: string;
	active?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className={`size-7 ${active ? "bg-muted text-foreground" : "text-muted-foreground"}`}
			title={label}
			aria-label={label}
			aria-pressed={active}
			data-panel-toggle={pane}
			onClick={onClick}
		>
			<Icon name={icon} className="size-3.5" />
		</Button>
	);
}

export default function DocView() {
	const doc = useStore($doc);
	const values = useStore($formValues);
	const body = useStore($body);
	const dirty = useStore($dirty);
	const [backup, setBackup] = useState<DraftBackup | null>(null);
	const [aiOpen, setAiOpen] = useState(false);
	// Wryte düzeni: paneller KAPALI başlar — araç çubuğunun sağındaki ikon
	// anahtarlarla (Outline / Araştırma) açılır; meta formu FRONTMATTER
	// satırındaki chevron ile yönetilir.
	const [outlineOpen, setOutlineOpen] = useState(false);
	const [researchOpen, setResearchOpen] = useState(false);
	const [panelOpen, setPanelOpen] = useState(false);
	// Wryte düzeni: araç çubuğu içerik sütununun en üstünde tek satırdır;
	// MdxBodyEditor içeriğini React portal ile buraya basar (context korunur).
	const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
	// Üst bar yuvaları: başlık girdisi breadcrumb'a, durum kümesi aksiyon
	// şeridine portal'lanır. Yuvalar TopBar'ın sabit DOM düğümleridir.
	const [chromeSlots, setChromeSlots] = useState<{ title: HTMLElement | null; actions: HTMLElement | null }>({
		title: null,
		actions: null,
	});

	useEffect(() => {
		setChromeSlots({
			title: document.querySelector("[data-doc-title-slot]"),
			actions: document.querySelector("[data-doc-actions-slot]"),
		});
	}, []);

	// Doküman açılınca: sunucu içeriğinden farklı bir yedek varsa bantta sun;
	// aynıysa (ya da kayıt sonrası kalmışsa) sessizce süpür.
	useEffect(() => {
		if (!doc) return;
		const site = currentSite();
		if (!site) return;
		let alive = true;
		void loadDraftBackup(site.repoFullName, doc.path).then((saved) => {
			if (!alive) return;
			const sameBody = saved?.body === $body.get();
			const sameValues = JSON.stringify(saved?.values ?? {}) === JSON.stringify($formValues.get());
			if (saved && (!sameBody || !sameValues)) {
				setBackup(saved);
			} else {
				setBackup(null);
				if (saved) void clearDraftBackup(site.repoFullName, doc.path);
			}
		});
		return () => {
			alive = false;
		};
	}, [doc?.path]);

	// Kirliyken ~800 ms sonra yedekle — sekme çökse de içerik kaybolmaz.
	// Yerel taslak sekmesindeyken duraklar: taslak içeriği kendi deposunda
	// yaşar (draft-tabs), yedek karışmasın.
	useEffect(() => {
		if (!doc || !dirty || $draftTabActive.get()) return;
		const site = currentSite();
		if (!site) return;
		const timer = setTimeout(() => {
			void saveDraftBackup({
				repo: site.repoFullName,
				path: doc.path,
				body,
				values,
				baseSha: doc.baseSha,
				savedAt: Date.now(),
			});
		}, 800);
		return () => clearTimeout(timer);
	}, [body, values, dirty, doc?.path]);

	const restoreBackup = () => {
		if (!backup) return;
		$formValues.set({ ...backup.values });
		$body.set(backup.body);
		$dirty.set(true);
		setBackup(null);
	};

	const dismissBackup = () => {
		const site = currentSite();
		if (site && doc) void clearDraftBackup(site.repoFullName, doc.path);
		setBackup(null);
	};

	/** Editöre bırakılan/yapıştırılan görseli yükler; markdown bağı döner. */
	const uploadEditorImage = async (file: File): Promise<string> => {
		const [outcome] = await uploadMedia([file], { entryScope: entryMediaScope() });
		return outcome?.link ?? "";
	};

	/** "Medyadan ekle": seçici → markdown'ı editörün imlecine bastır.
	 *  Manifestte genişlik varsa markdown yerine HTML img (width %) ekler. */
	const requestMedia = (insert: (markdown: string) => void) => {
		pickMedia((link, path) => {
			const width = $mediaWidths.get()[path];
			const alt = mediaAltFor(path) || "görsel";
			insert(width ? `<img src="${link}" alt="${alt}" style="width: ${width}%" />` : `![${alt}](${link})`);
		});
	};

	const controls = useMemo(
		() => (doc ? buildControls(currentCollection(), doc) : []),
		// doc'un path'i ve şema anahtarları değişince yeniden türet
		[doc?.path, doc?.order.join(","), currentCollection()],
	);
	if (!doc) return null;

	const titleControl = controls.find((c) => c.name === "title");
	const status = normalizeStatus(values["status"]);

	// Üst bar yuvalarına portallar: Wryte'ta başlık ve durum, içeride değil
	// uygulama şapkasında yaşar. Aynı React context ağacı korunur.
	const titlePortal =
		titleControl && chromeSlots.title
			? createPortal(
					<input
						type="text"
						placeholder={t("docview.titlePlaceholder")}
						aria-label={t("docview.titlePlaceholder")}
						value={values["title"] ?? ""}
						onChange={(event) => setFormValue("title", event.target.value)}
						className="h-7 w-full min-w-0 max-w-[46ch] rounded-md bg-transparent px-1.5 text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/50 hover:bg-accent/60 focus:bg-accent/60"
					/>,
					chromeSlots.title
				)
			: null;
	const actionsPortal = chromeSlots.actions
		? createPortal(
				<>
					<Badge shape="pill" size="sm" className={STATUS_CHIP_CLS[status]}>
						{t(statusLabel(status))}
					</Badge>
					{STATUS_OPTIONS.map((option) => (
						<Button
							key={option.value}
							type="button"
							variant={status === option.value ? "default" : "ghost"}
							size="sm"
							className="h-6 px-2 text-[11px]"
							onClick={() => setDocField("status", option.value)}
						>
							{t(statusLabel(option.value))}
						</Button>
					))}
					<span className="mx-0.5 h-4 w-px bg-border" />
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-[11px]"
						title={t("docview.reviewHint")}
						onClick={() => void startDocReview()}
					>
						{t("editor.sendToReview")}
					</Button>
				</>,
				chromeSlots.actions
			)
		: null;

	// Araç çubuğunun sağındaki sütun anahtarları (Wryte: Split'in sağındaki ikonlar).
	const toolbarTrailing = (
		<>
			<PanelToggle
				icon="list"
				pane="outline"
				label={t("docview.panelOutline")}
				active={outlineOpen}
				onClick={() => setOutlineOpen((open) => !open)}
			/>
			<PanelToggle
				icon="link"
				pane="research"
				label={t("docview.panelResearch")}
				active={researchOpen}
				onClick={() => setResearchOpen((open) => !open)}
			/>
			<PanelToggle icon="sparkles" pane="ai" label={t("docview.aiGenerate")} onClick={() => setAiOpen(true)} />
		</>
	);

	return (
		<div className="flex min-h-full flex-col">
			{/* Wryte: araç çubuğu şeridi sayfanın tam genişliğidir — yan kolon
			   açılsa bile kolon şeridin ALTINDAN başlar, araç çubuğu sıkışmaz. */}
			<div className="px-5 pt-3 lg:px-8">
				{backup && (
					<div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
						<span className="text-muted-foreground">
							{t("docview.backupBanner", {
								time: new Date(backup.savedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
							})}
						</span>
						<span className="ml-auto flex items-center gap-1">
							<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={restoreBackup}>
								{t("docview.backupRestore")}
							</Button>
							<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={dismissBackup}>
								{t("docview.backupDiscard")}
							</Button>
						</span>
					</div>
				)}
				{titlePortal}
				{actionsPortal}
				{/* Araç çubuğu yuvası: tek satır, sığmazsa yatay kayar (Wryte gibi). */}
				<div
					ref={setToolbarEl}
					data-editor-toolbar=""
					className="mdx-toolbar-slot mb-0 flex min-h-9 flex-nowrap items-center gap-0.5 overflow-x-auto border-b border-border pb-1"
				/>
			</div>
			{/* Şeridin altında: editör kolonu + sağdaki yan kolonlar yan yana. */}
			<div className="flex min-w-0 flex-1 flex-col lg:flex-row">
			<div className="min-w-0 flex-1 px-5 pb-8 lg:px-8">
					{/* Sekmeler (Main / + Taslak) — Wryte'taki önizleme şeridinin üstü. */}
					<DraftTabs />
					{/* FRONTMATTER satırı: sola hizalı küme — chevron meta formunu
					    açar, skor rozeti ve durum noktası yanında (Wryte: 4/10 ● READY). */}
					<div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border py-1.5">
						<button
							type="button"
							data-panel-toggle="meta"
							aria-pressed={panelOpen}
							title={panelOpen ? t("docview.panelHide") : t("docview.panelShow")}
							onClick={() => setPanelOpen((open) => !open)}
							className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
						>
							<Icon name="chevron-right" className={`size-3 transition-transform ${panelOpen ? "rotate-90" : ""}`} />
							Frontmatter
						</button>
						<span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80 tabular-nums">
							{readiness(values, body).score}/100
						</span>
						<span
							className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_TEXT_CLS[status]}`}
						>
							<span className={`size-1.5 rounded-full ${STATUS_DOT_CLS[status]}`} />
							{t(statusLabel(status))}
						</span>
					</div>
					<MdxBodyEditor
						key={doc.path}
						value={body}
						toolbarContainer={toolbarEl}
						trailing={toolbarTrailing}
						onChange={(markdown) => {
							$body.set(markdown);
							$dirty.set(true);
						}}
						onUploadImage={uploadEditorImage}
						onRequestMedia={requestMedia}
					/>
					<AiGenerateDialog open={aiOpen} onClose={() => setAiOpen(false)} />
			</div>
			{(outlineOpen || researchOpen || panelOpen) && (
				/* Wryte düzeni: paneller sayfa boyunca uzanan yapışık kolonlardır —
				   kart değil; aralarında yalnızca ince ayraç çizgiler var. */
					<aside className="flex w-full shrink-0 flex-col self-stretch border-t border-border lg:w-auto lg:flex-row lg:border-t-0">
						{outlineOpen && (
							<div className="w-full border-t border-border p-4 first:border-t-0 lg:w-[270px] lg:border-l lg:border-t-0">
								<BodyOutline body={body} onClose={() => setOutlineOpen(false)} />
							</div>
						)}
						{researchOpen && (
							<div className="w-full border-t border-border p-4 first:border-t-0 lg:w-[380px] lg:border-l lg:border-t-0">
								<ResearchPanel onClose={() => setResearchOpen(false)} />
							</div>
						)}
						{panelOpen && (
							<div
								data-panel="meta"
								className="w-full border-t border-border p-4 first:border-t-0 lg:w-[340px] lg:border-l lg:border-t-0"
							>
								<div className="mb-2 flex items-center justify-between gap-2">
									<p className="text-sm font-medium text-foreground">Frontmatter</p>
									<button
										type="button"
										className="text-[11px] text-muted-foreground hover:text-foreground"
										title={t("common.close")}
										onClick={() => setPanelOpen(false)}
									>
										✕
									</button>
								</div>
								<MetaPanel controls={controls} />
							</div>
						)}
					</aside>
			)}
			</div>
		</div>
	);
}
