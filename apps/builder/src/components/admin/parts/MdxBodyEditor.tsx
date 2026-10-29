// Gövde editörü — mdxeditor.dev (kullanıcı direktifi). Yaz / Böl / Oku modları,
// araç çubuğu, odak (tam ekran) modu ve medya entegrasyonu (yükleme + seçici).
//
// Markdown tek doğru kaynaktır: değer $body'den gelir, değişiklikler onChange
// ile geri akar. Frontmatter bu bileşene hiç girmez (form paneli yönetir).
// Dış değer değişimleri (taslak geri yükleme, doküman değişimi) editörü
// yeniden kurar — mdxeditor'ı her tuşta yeniden ayrıştırmamak için bilinçli.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
	BlockTypeSelect,
	BoldItalicUnderlineToggles,
	CodeToggle,
	CreateLink,
	InsertImage,
	InsertTable,
	InsertThematicBreak,
	ListsToggle,
	MDXEditor,
	type MDXEditorMethods,
	Separator,
	UndoRedo,
	activeEditor$,
	codeBlockPlugin,
	codeMirrorPlugin,
	headingsPlugin,
	imagePlugin,
	insertMarkdown$,
	jsxPlugin,
	linkDialogPlugin,
	linkPlugin,
	listsPlugin,
	markdownShortcutPlugin,
	quotePlugin,
	tablePlugin,
	thematicBreakPlugin,
	toolbarPlugin,
	useCellValue,
	usePublisher,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { Button } from "@/components/ui-react/button";
import { Icon } from "../parts";
import { $insertRequest } from "@/lib/admin/editor-bridge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
} from "@/components/ui-react/dialog";
import { Input } from "@/components/ui-react/input";
import { detectEmbed, EMBED_PROVIDERS } from "@/lib/admin/embeds";
import { mediaSrcForEditor } from "@/lib/admin/media";
import { countMatches, countWords, replaceAllMatches, replaceFirst } from "@/lib/admin/find-replace";
import { $locale, t } from "@/lib/i18n";

export type BodyEditorMode = "write" | "split" | "read";

type Props = {
	/** Markdown gövdesi (kaynak doğru). */
	value: string;
	/** Her değişiklikte yeni markdown (gövde + kirli bayrağı üstte). */
	onChange: (markdown: string) => void;
	/** Editöre bırakılan/yapıştırılan görselleri yükler; bağ döndürür. */
	onUploadImage: (file: File) => Promise<string>;
	/** "Medyadan ekle": seçiciyi açar; seçilince markdown'ı editöre basar. */
	onRequestMedia: (insert: (markdown: string) => void) => void;
	/** Başlangıç modu (varsayılan: yaz). */
	initialMode?: BodyEditorMode;
	/**
	 * Wryte düzeni: araç çubuğu editörün üstünde tam genişlik bir satırda durur.
	 * Bileşen oraya portal'lanır (React context'i korur — mdxeditor düğmeleri
	 * realm'e bağlı kalır). Odak modunda devre dışı: araç çubuğu taşınan
	 * katmanın içinde kalmalı, yoksa "Odaktan çık" erişilemez olur.
	 */
	toolbarContainer?: HTMLElement | null;
	/** Wryte düzeni: araç çubuğunun sağında görünen panel anahtar ikonları
	 *  (DocView'dan gelir; portal onlarla birlikte taşınır). */
	trailing?: ReactNode;
};

/** Embed diyaloğu — bağlantıyı tanır, gömme HTML'ini editöre basar. */
function EmbedDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (html: string) => void }) {
	const [url, setUrl] = useState("");
	const embed = detectEmbed(url);
	return (
		<Dialog open onClose={onClose}>
			<DialogOverlay />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("editor.embedTitle")}</DialogTitle>
					<DialogDescription>{t("editor.embedDesc")}</DialogDescription>
				</DialogHeader>
				<Input
					aria-label="Embed bağlantısı"
					placeholder="https://youtu.be/…"
					value={url}
					onChange={(event) => setUrl(event.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					{embed
						? t("editor.embedDetected", { provider: embed.label })
						: url.trim()
							? t("editor.embedUnknown", { list: EMBED_PROVIDERS.join(", ") })
							: t("editor.embedSupported", { list: EMBED_PROVIDERS.join(", ") })}
				</p>
				<DialogFooter className="flex flex-row items-center justify-end gap-2">
					<Button type="button" variant="secondary" size="sm" onClick={onClose}>
						{t("common.close")}
					</Button>
					<Button type="button" size="sm" disabled={!embed} onClick={() => embed && onInsert(embed.html)}>
						{t("common.add")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** mm:ss biçiminde kalan süre. */
function formatClock(ms: number): string {
	const total = Math.max(0, Math.round(ms / 1000));
	const minutes = String(Math.floor(total / 60)).padStart(2, "0");
	const seconds = String(total % 60).padStart(2, "0");
	return `${minutes}:${seconds}`;
}

/** Bul & Değiştir bandı (Wryte paritesi) — markdown üzerinde çalışır; eşleşme
 *  gezinmesi görünen içerikte tarayıcının window.find'ı ile yapılır. */
function FindBar({
	value,
	onApply,
	onClose,
}: {
	value: string;
	onApply: (next: string) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const [replacement, setReplacement] = useState("");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const matches = countMatches(value, query, caseSensitive);

	const hop = (backwards: boolean) => {
		const finder = (window as unknown as { find?: (s: string, cs?: boolean, b?: boolean) => boolean }).find;
		finder?.(query, caseSensitive, backwards);
	};

	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-1.5">
			<Input
				size="sm"
				aria-label={t("editor.find")}
				className="h-7 w-40"
				placeholder={t("editor.find")}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			<span className="text-[11px] tabular-nums text-muted-foreground">
				{t("editor.findMatches", { count: matches })}
			</span>
			<Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs" title={t("editor.prevMatch")} onClick={() => hop(true)}>
				↑
			</Button>
			<Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs" title={t("editor.nextMatch")} onClick={() => hop(false)}>
				↓
			</Button>
			<Input
				size="sm"
				aria-label={t("editor.replaceWith")}
				className="h-7 w-40"
				placeholder={t("editor.replaceWith")}
				value={replacement}
				onChange={(event) => setReplacement(event.target.value)}
			/>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-7 px-2 text-xs"
				disabled={!query}
				onClick={() => {
					const result = replaceFirst(value, query, replacement, caseSensitive);
					if (result.replaced) onApply(result.text);
				}}
			>
				{t("editor.replace")}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-7 px-2 text-xs"
				disabled={!query}
				onClick={() => {
					const result = replaceAllMatches(value, query, replacement, caseSensitive);
					if (result.count > 0) onApply(result.text);
				}}
			>
				{t("editor.replaceAll")}
			</Button>
			<Button
				type="button"
				variant={caseSensitive ? "default" : "ghost"}
				size="sm"
				className="h-7 px-2 text-xs"
				title={t("editor.caseSensitive")}
				onClick={() => setCaseSensitive((current) => !current)}
			>
				Aa
			</Button>
			<Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={onClose}>
				{t("common.close")}
			</Button>
		</div>
	);
}

/** Yazı sprinti (Wryte paritesi): kelime hedefi + süre; oturum istatistikleri. */
function SprintDialog({
	open,
	onClose,
	words,
	sprint,
	onStart,
	onEnd,
	typewriter,
	onTypewriter,
}: {
	open: boolean;
	onClose: () => void;
	words: number;
	sprint: { startedAt: number; endsAt: number; targetWords: number; startedWords: number } | null;
	onStart: (options: { targetWords: number; durationMin: number }) => void;
	onEnd: () => void;
	typewriter: boolean;
	onTypewriter: (value: boolean) => void;
}) {
	const [target, setTarget] = useState(500);
	const [duration, setDuration] = useState(25);
	if (!open) return null;

	const remaining = sprint ? sprint.endsAt - Date.now() : 0;
	const written = sprint ? Math.max(0, words - sprint.startedWords) : 0;
	const minutes = sprint ? Math.max(1, Math.round((Date.now() - sprint.startedAt) / 60_000)) : 0;
	const wpm = sprint ? Math.round(written / minutes) : 0;
	const progress = sprint ? Math.min(100, Math.round((written / sprint.targetWords) * 100)) : 0;

	return (
		<Dialog open onClose={onClose}>
			<DialogOverlay />
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("editor.sprintTitle")}</DialogTitle>
					<DialogDescription>{t("editor.sprintBody")}</DialogDescription>
				</DialogHeader>
				{!sprint ? (
					<div className="grid gap-4">
						<div>
							<p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("editor.sprintTarget")}</p>
							<div className="grid grid-cols-3 gap-2">
								{[250, 500, 750].map((value) => (
									<Button
										key={value}
										type="button"
										variant={target === value ? "default" : "secondary"}
										size="sm"
										className="w-full justify-center tabular-nums"
										aria-pressed={target === value}
										onClick={() => setTarget(value)}
									>
										{value}
									</Button>
								))}
							</div>
						</div>
						<div>
							<p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("editor.sprintDuration")}</p>
							<div className="grid grid-cols-3 gap-2">
								{[15, 25, 45].map((value) => (
									<Button
										key={value}
										type="button"
										variant={duration === value ? "default" : "secondary"}
										size="sm"
										className="w-full justify-center tabular-nums"
										aria-pressed={duration === value}
										onClick={() => setDuration(value)}
									>
										{t("editor.sprintMin", { count: value })}
									</Button>
								))}
							</div>
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								className="size-4 accent-primary"
								checked={typewriter}
								onChange={(event) => onTypewriter(event.target.checked)}
							/>
							{t("editor.typewriter")}
						</label>
					</div>
				) : (
					<div className="grid gap-2 text-xs">
						<p>
							{t("editor.sprintRemaining")}:{" "}
							<span className="font-medium tabular-nums">{formatClock(remaining)}</span>
						</p>
						<p>
							{t("editor.sprintWritten")}: <span className="font-medium tabular-nums">{written}</span> ·{" "}
							{wpm} {t("editor.sprintWpm")}
						</p>
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
							<div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
						</div>
						<p className="text-muted-foreground">
							{written}/{sprint.targetWords} (%{progress})
						</p>
					</div>
				)}
				<DialogFooter className="flex flex-row items-center justify-end gap-2">
					<Button type="button" variant="secondary" size="sm" onClick={onClose}>
						{t("common.close")}
					</Button>
					{!sprint ? (
						<Button type="button" size="sm" onClick={() => onStart({ targetWords: target, durationMin: duration })}>
							{t("editor.sprintStart")}
						</Button>
					) : (
						<Button type="button" size="sm" onClick={onEnd}>
							{t("editor.sprintEnd")}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Araç çubuğu — mdxeditor bileşenleri + medya/embed/kopya + mod & kelime sayacı
 *  (Wryte düzeni: tek satırda yazım araçları ve görünüm anahtarları). */
function Toolbar({
	onRequestMedia,
	onEmbedInsert,
	getMarkdown,
	mode,
	onMode,
	onFocus,
	focus,
	words,
	findOpen,
	onToggleFind,
	sprintRunning,
	sprintRemaining,
	onToggleSprint,
	splitPane,
	onSplitPane,
	trailing,
}: Pick<Props, "onRequestMedia"> & {
	getMarkdown: () => string;
	onEmbedInsert: (html: string) => void;
	mode: BodyEditorMode;
	onMode: (mode: BodyEditorMode) => void;
	onFocus: () => void;
	focus: boolean;
	words: number;
	findOpen: boolean;
	onToggleFind: () => void;
	sprintRunning: boolean;
	sprintRemaining: string;
	onToggleSprint: () => void;
	splitPane: "preview" | "source";
	onSplitPane: (pane: "preview" | "source") => void;
	trailing?: ReactNode;
}) {
	const insertMarkdown = usePublisher(insertMarkdown$);
	const activeEditor = useCellValue(activeEditor$);
	const [copied, setCopied] = useState<"md" | "html" | null>(null);
	const [embedOpen, setEmbedOpen] = useState(false);

	const modeButton = (target: BodyEditorMode, label: string) => (
		<Button
			key={target}
			type="button"
			variant={mode === target ? "default" : "ghost"}
			size="sm"
			className="h-7 px-2.5 text-xs"
			onClick={() => onMode(target)}
		>
			{label}
		</Button>
	);

	const copy = async (kind: "md" | "html") => {
		const text =
			kind === "md" ? getMarkdown() : (activeEditor?.getRootElement()?.innerHTML ?? "");
		try {
			await navigator.clipboard?.writeText(text);
		} catch {
			/* pano izni yoksa sessiz geç */
		}
		setCopied(kind);
		setTimeout(() => setCopied(null), 1500);
	};

	return (
		<>
			{/* Kayar küme: yatay sığmazsa kendisi kayar — sağ ucu sabit küme boşmaz. */}
			<div
				data-toolbar-scroll=""
				className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto"
			>
				<UndoRedo />
				<Separator />
				<BoldItalicUnderlineToggles />
				<CodeToggle />
				<Separator />
				<BlockTypeSelect />
				<Separator />
				<ListsToggle />
				<Separator />
				<CreateLink />
				<InsertImage />
				<InsertTable />
				<InsertThematicBreak />
				<Separator />
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={() =>
						// Seçici diyaloğu odağı alır; yayınlamadan önce editöre dön —
						// yoksa insertMarkdown$ seçim bulamaz ve sessizce düşer.
						onRequestMedia((markdown) => {
							activeEditor?.focus();
							insertMarkdown(markdown);
						})
					}
				>
					{t("editor.insertFromMedia")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					title={t("editor.embedBtnTitle")}
					onClick={() => setEmbedOpen(true)}
				>
					Embed
				</Button>
				<Separator />
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					title={t("editor.copyMdTitle")}
					onClick={() => void copy("md")}
				>
					{copied === "md" ? "MD ✓" : t("editor.copyMd")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					title={t("editor.copyHtmlTitle")}
					onClick={() => void copy("html")}
				>
					{copied === "html" ? "HTML ✓" : t("editor.copyHtml")}
				</Button>
				<Separator />
				<Button
					type="button"
					variant={findOpen ? "default" : "ghost"}
					size="sm"
					className="h-7 px-2.5 text-xs"
					title={t("editor.find")}
					onClick={onToggleFind}
				>
					{t("editor.find")}
				</Button>
				<Button
					type="button"
					variant={sprintRunning ? "default" : "ghost"}
					size="sm"
					className="h-7 px-2.5 text-xs"
					title={t("editor.sprintTitle")}
					onClick={onToggleSprint}
				>
					{sprintRunning ? `${t("editor.sprint")} ${sprintRemaining}` : t("editor.sprint")}
				</Button>
				<Separator />
				<span className="ml-auto shrink-0 px-1 text-[11px] tabular-nums text-muted-foreground">
					{t("editor.words", {
						count: words.toLocaleString($locale.get() === "tr" ? "tr-TR" : "en-US"),
					})}
				</span>
				<Separator />
				{modeButton("write", t("editor.write"))}
				{modeButton("split", t("editor.split"))}
				{modeButton("read", t("editor.read"))}
			</div>
			{/* Sabit küme: böl bölmesi ikonları + sütun anahtarları + odak —
			    kayan alan taşsa bile sağ uç her zaman görünür (Wryte). */}
			<div className="ml-1 flex flex-none items-center gap-0.5 border-l border-border pl-1.5">
				{mode === "split" && (
					<>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className={`size-7 ${splitPane === "preview" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
							title={t("editor.preview")}
							aria-label={t("editor.preview")}
							aria-pressed={splitPane === "preview"}
							data-split-pane="preview"
							onClick={() => onSplitPane("preview")}
						>
							<Icon name="eye" className="size-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className={`size-7 ${splitPane === "source" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
							title={t("editor.source")}
							aria-label={t("editor.source")}
							aria-pressed={splitPane === "source"}
							data-split-pane="source"
							onClick={() => onSplitPane("source")}
						>
							<Icon name="code" className="size-3.5" />
						</Button>
					</>
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 shrink-0 px-2 text-xs"
					title={t("editor.focusTitle")}
					onClick={onFocus}
				>
					{focus ? t("editor.focusExit") : t("editor.focus")}
				</Button>
				{trailing && <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />}
				{trailing}
			</div>
			{embedOpen && (
				<EmbedDialog
					onClose={() => setEmbedOpen(false)}
					onInsert={(html) => {
						// Blok HTML seçime insertMarkdown ile eklenemez (bkz. insertEmbedHtml).
						onEmbedInsert(html);
						setEmbedOpen(false);
					}}
				/>
			)}
		</>
	);
}

/** Gövde tipografisi — yazım ve önizleme aynı sınıfları kullanır. */
const PROSE_CLS =
	"text-[15px] leading-7 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_img]:my-4 [&_img]:rounded-lg";

/** Önizleme, sitedeki makale tipografisine yakın olsun — yazımdan biraz daha büyük. */
const PROSE_CLS_PREVIEW = PROSE_CLS.replace("text-[15px] leading-7", "text-[17px] leading-8");

/** Kod bloğu dilleri — yazım ve önizleme editörleri aynı listeyi kullanır. */
const CODE_LANGS = {
	"": "Düz metin",
	js: "JavaScript",
	ts: "TypeScript",
	jsx: "JSX",
	tsx: "TSX",
	css: "CSS",
	html: "HTML",
	json: "JSON",
	bash: "Bash",
	yaml: "YAML",
	md: "Markdown",
};

export default function MdxBodyEditor({
	value,
	onChange,
	onUploadImage,
	onRequestMedia,
	initialMode = "write",
	toolbarContainer,
	trailing,
}: Props) {
	const [mode, setMode] = useState<BodyEditorMode>(initialMode);
	const [focus, setFocus] = useState(false);
	const lastEmitted = useRef(value);
	const editorRef = useRef<MDXEditorMethods>(null);
	const [editorKey, setEditorKey] = useState(0);
	// Böl modunun sağ bölmesi: canlı önizleme (varsayılan) ya da ham kaynak.
	const [splitPane, setSplitPane] = useState<"preview" | "source">("preview");
	const [previewValue, setPreviewValue] = useState(value);
	const [previewSeq, setPreviewSeq] = useState(0);
	// Odak modunda portal yapılmaz: araç çubuğu tam ekran katmanının içinde kalmalı.
	const portaled = Boolean(toolbarContainer) && !focus;
	const words = useMemo(() => countWords(value), [value]);
	const [findOpen, setFindOpen] = useState(false);
	const [sprintOpen, setSprintOpen] = useState(false);
	const [typewriter, setTypewriter] = useState(false);
	const [sprint, setSprint] = useState<{
		startedAt: number;
		endsAt: number;
		durationMin: number;
		targetWords: number;
		startedWords: number;
	} | null>(null);
	const [, setTick] = useState(0);

	// Sprint süresi canlı aksın (saniyelik tik).
	useEffect(() => {
		if (!sprint) return;
		const timer = setInterval(() => setTick((n) => n + 1), 1000);
		return () => clearInterval(timer);
	}, [sprint]);

	// Typewriter kaydırma: odak modunda imleç satırı ortada kalsın.
	useEffect(() => {
		if (!focus || !typewriter) return;
		const selection = window.getSelection();
		const node = selection?.anchorNode;
		if (!node) return;
		const element = node instanceof Element ? node : node.parentElement;
		element?.scrollIntoView({ block: "center" });
	}, [value, focus, typewriter]);

	/** Dış değer güncellemesi (bul-değiştir, embed) — mdxeditor mount sonrası
	 *  istemlidir (markdown prop'unu yeniden import etmez); tam yeniden kurulum
	 *  (key artışı) ile taze realm yüklenir. Böylece editör DOM'u, kaynak panel
	 *  ve $body hep aynı markdown'ı görür. */
	const applyText = (next: string) => {
		lastEmitted.current = next;
		setEditorKey((k) => k + 1);
		onChange(next);
	};

	/** Embed HTML'i gövde sonuna blok olarak ekler. insertMarkdown seçim
	 *  bağlamına (paragraf) blok içeriği alamaz ve mdxeditor ayrıştırama
	 *  hatasında kurtarma yoluyla TÜM BELGEYİ ham string ile değiştirir
	 *  (e2e-editor-crud ile kanıtlandı); bu yüzden kök yeniden kurulum
	 *  kullanılır. Editör geçmişi sıfırlanır — içerik kaybına karşı kabul
	 *  edilebilir bedel. */
	const insertEmbedHtml = (html: string) => {
		const trimmed = value.replace(/\s+$/, "");
		applyText(`${trimmed ? `${trimmed}\n\n` : ""}${html}\n`);
	};

	// Editör köprüsü: panel bileşenleri (Research bağlantı önerileri) gövdeye
	// markdown eklemek için $insertRequest'e yazar; burada ref üzerinden
	// uygulanır. insertMarkdown seçim ister → önce odaklan.
	useEffect(
		() =>
			$insertRequest.subscribe((request) => {
				if (!request) return;
				const editor = editorRef.current;
				if (!editor) return;
				editor.focus();
				editor.insertMarkdown(request.markdown);
			}),
		[],
	);

	// Wryte paritesi: Ctrl+Shift+F odak modunu açar/kapatır; odak modunda
	// Escape odaktan çıkarır (açık diyalog varsa önce o kapanır).
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.shiftKey && (event.key === "F" || event.key === "f")) {
				event.preventDefault();
				setFocus((f) => !f);
			} else if (event.key === "Escape" && !event.defaultPrevented) {
				setFocus((f) => {
					if (!f) return f;
					// Diyaloğu Radix aynı olayda kapatıyor; DOM'dan düşene kadar
					// bekle — Escape ikisini birden kapatmasın.
					if (document.querySelector('[role="dialog"]')) return f;
					return false;
				});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// Dış kaynaklı değer değişimi (geri yükleme, doküman değişimi) → yeniden kur.
	useEffect(() => {
		if (value !== lastEmitted.current) {
			lastEmitted.current = value;
			setEditorKey((k) => k + 1);
		}
	}, [value]);

	// Canlı önizleme: 350 ms debounce. mdxeditor `markdown` prop'unu uzlaştırmaz
	// (yalnızca ilk kurulumda okur) → debounce sonrası önizleme yeniden kurulur.
	// Salt okunur olduğundan imleç/seçim kaybı yoktur.
	useEffect(() => {
		if (previewValue === value) return;
		const timer = setTimeout(() => {
			setPreviewValue(value);
			setPreviewSeq((seq) => seq + 1);
		}, 350);
		return () => clearTimeout(timer);
	}, [value, previewValue]);

	const plugins = [
		headingsPlugin(),
		listsPlugin(),
		quotePlugin(),
		thematicBreakPlugin(),
		markdownShortcutPlugin(),
		linkPlugin(),
		linkDialogPlugin(),
		tablePlugin(),
		jsxPlugin(),
		codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
		codeMirrorPlugin({ codeBlockLanguages: { ...CODE_LANGS, "": t("editor.langPlain") } }),
		imagePlugin({
			imageUploadHandler: async (file) => onUploadImage(file),
			// media:// ve göreli bağları editörde gerçek görselle göster;
			// markdown src'si değişmez (repo-only ADR).
			imagePreviewHandler: async (src) => mediaSrcForEditor(src),
		}),
		toolbarPlugin({
			// Wryte düzeni: çubuk, editörün üstündeki tam genişlik yuvaya
			// portal'lanır (React context realm'de kalır — mdxeditor düğmeleri
			// çalışmaya devam eder). Odak modunda editörün içinde kalır.
			toolbarContents: () => {
				// Odak modunda panel anahtarları gizlenir: paneller katmanın
				// altında kalacağı için açmak yanıltıcı olur.
				const toolbar = (
					<Toolbar
						onRequestMedia={onRequestMedia}
						onEmbedInsert={insertEmbedHtml}
						getMarkdown={() => value}
						mode={mode}
						onMode={setMode}
						onFocus={() => setFocus((f) => !f)}
						focus={focus}
						words={words}
						findOpen={findOpen}
						onToggleFind={() => setFindOpen((open) => !open)}
						sprintRunning={Boolean(sprint)}
						sprintRemaining={sprint ? formatClock(sprint.endsAt - Date.now()) : "00:00"}
						onToggleSprint={() => setSprintOpen(true)}
						splitPane={splitPane}
						onSplitPane={setSplitPane}
						trailing={focus ? undefined : trailing}
					/>
				);
				return portaled && toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar;
			},
		}),
	];

	// Önizleme ayrı bir realm'dir: araç çubuğu içermeyen, yalnızca düğümleri
	// çözen bir eklenti seti alır (salt okunur görünüm için yeterli).
	const previewPlugins = [
		headingsPlugin(),
		listsPlugin(),
		quotePlugin(),
		thematicBreakPlugin(),
		markdownShortcutPlugin(),
		linkPlugin(),
		tablePlugin(),
		jsxPlugin(),
		codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
		codeMirrorPlugin({ codeBlockLanguages: { ...CODE_LANGS, "": t("editor.langPlain") } }),
		imagePlugin({
			imageUploadHandler: async (file) => onUploadImage(file),
			imagePreviewHandler: async (src) => mediaSrcForEditor(src),
		}),
	];

	return (
		<div
			className={
				focus
					? "fixed inset-0 z-50 overflow-auto bg-background"
					: mode === "split"
						? // Wryte düzeni: bölünme çerçevesiz — bölümler boşlukla ayrılır.
							""
						: "rounded-lg border border-border"
			}
		>
			<div className={focus ? "flex min-h-full w-full flex-col" : ""}>
				{findOpen && (
					<FindBar value={value} onApply={applyText} onClose={() => setFindOpen(false)} />
				)}
				{/* Wryte düzeni: araç çubuğu tek satırdır; sığmayan sağ uç yatay
				    kayar. mdxeditor değişkenleri bizim temaya bağlanır (aksi hâlde
				    açık tema varsayılanı koyu temada soluk kalır). */}
				<style>{`
					.mdx-toolbar-wrap .mdxeditor-toolbar,
					.mdx-toolbar-slot > .mdxeditor-toolbar {
						flex-wrap: nowrap;
						align-items: center;
						height: auto;
						overflow: visible;
						background: transparent;
						border: 0;
					}
					.mdx-toolbar-wrap .mdxeditor {
						color: inherit;
						--baseText: currentColor;
						--baseTextContrast: currentColor;
						--baseBg: color-mix(in oklab, currentColor 7%, transparent);
						--baseBgActive: color-mix(in oklab, currentColor 15%, transparent);
						--baseBorder: var(--border);
						--baseBorderHover: color-mix(in oklab, currentColor 30%, transparent);
					}
					.mdx-toolbar-wrap .mdxeditor-toolbar button[class*="selectTrigger"] {
						background: transparent;
						color: inherit;
						border-color: var(--border);
					}
					.mdx-toolbar-wrap .mdxeditor-toolbar button,
					.mdx-toolbar-wrap .mdxeditor-toolbar [role="button"] {
						color: color-mix(in oklab, currentColor 80%, transparent);
					}
					.mdx-toolbar-wrap .mdxeditor-toolbar button:hover,
					.mdx-toolbar-wrap .mdxeditor-toolbar [role="button"]:hover {
						color: currentColor;
					}
					.mdx-toolbar-wrap .mdxeditor-toolbar select,
					.mdx-toolbar-wrap .mdxeditor-select {
						background: transparent;
						color: inherit;
						border-color: var(--border);
					}
					.mdx-toolbar-wrap .mdxeditor-toolbar select option {
						color: CanvasText;
						background: Canvas;
					}
					/* Araç çubuğu yuvaya portal'landığında editörün kendi çubuğu
					   boşalır; yuva aynı tema değişkenlerini miras alır. */
					.mdx-toolbar-wrap.toolbar-portaled .mdxeditor-toolbar {
						display: none;
					}
					/* Portalled çubuk yuvada tek satır olsun: kök yuvaya sığar,
					   kayan küme kendi içinde yatay kayar, sabit küme sağda kalır. */
					.mdx-toolbar-slot > .mdxeditor-toolbar {
						flex: 1 1 0%;
						min-width: 0;
					}
					/* Kayan kümenin kaydırma çubuğu gizlenir (sabit sağ uç zaten
					   görünür); dar ekranda içerik sessizce kayar. */
					[data-toolbar-scroll] {
						scrollbar-width: none;
					}
					[data-toolbar-scroll]::-webkit-scrollbar {
						height: 0;
						width: 0;
					}
					/* Odak modu: araç çubuğu üstte yapışkan tam genişlik şerittir;
					   yazı sütunu contentEditable'da okuma genişliğine sabitlenir. */
					.mdx-focus-mode .mdxeditor-toolbar {
						position: sticky;
						top: 0;
						z-index: 10;
						background: var(--background);
						border-bottom: 1px solid var(--border) !important;
						padding: 4px 10px;
					}
					/* Odak modu: mdxeditor'ın içerik çerçevesi çizgisiz kalsın. */
					.mdx-focus-mode .mdxeditor {
						border: 0;
						box-shadow: none;
					}
					/* Kod blokları: CodeMirror açık tema varsayılanı koyu temada
					   beyaz kutu gibi duruyor — tema değişkenlerine bağlanır. */
					.mdx-body-editor .cm-editor,
					.mdx-body-editor .cm-scroller,
					.mdx-body-editor .cm-content,
					.mdx-body-editor .cm-gutters {
						background-color: color-mix(in oklab, var(--foreground) 8%, transparent) !important;
					}
					.mdx-body-editor .cm-gutters {
						color: color-mix(in oklab, var(--foreground) 45%, transparent) !important;
						border-right: 1px solid var(--border);
					}
					.mdx-body-editor .cm-content {
						color: var(--foreground);
					}
					.mdx-body-editor .cm-activeLine,
					.mdx-body-editor .cm-activeLineGutter {
						background-color: color-mix(in oklab, var(--foreground) 6%, transparent);
					}
					.mdx-body-editor .cm-editor .cm-editor__selection,
					.mdx-body-editor .cm-selectionBackground {
						background: color-mix(in oklab, var(--foreground) 18%, transparent) !important;
					}
					.mdx-body-editor .cm-editor.cm-focused:focus-visible {
						outline: none;
					}
					.mdx-body-editor [class*="codeBlockEditor"],
					.mdx-body-editor [class*="codeBlock"] {
						background: transparent;
					}
					.mdx-body-editor select {
						background: var(--muted);
						color: var(--foreground);
						border-color: var(--border);
					}
					.mdx-body-editor select option {
						color: var(--foreground);
						background: var(--muted);
					}
					/* Öğeler sıkışmasın: taşma kaydırma ile çözülür (Wryte). */
					[data-toolbar-scroll] > * {
						flex-shrink: 0;
					}
					.mdx-toolbar-slot {
						color: inherit;
						--baseText: currentColor;
						--baseTextContrast: currentColor;
						--baseBg: color-mix(in oklab, currentColor 7%, transparent);
						--baseBgActive: color-mix(in oklab, currentColor 15%, transparent);
						--baseBorder: var(--border);
						--baseBorderHover: color-mix(in oklab, currentColor 30%, transparent);
					}
					.mdx-toolbar-slot button[class*="selectTrigger"] {
						background: transparent;
						color: inherit;
						border-color: var(--border);
					}
					.mdx-toolbar-slot button,
					.mdx-toolbar-slot [role="button"] {
						color: color-mix(in oklab, currentColor 80%, transparent);
					}
					.mdx-toolbar-slot button:hover,
					.mdx-toolbar-slot [role="button"]:hover {
						color: currentColor;
					}
					.mdx-toolbar-slot select {
						background: transparent;
						color: inherit;
						border-color: var(--border);
					}
					.mdx-toolbar-slot select option {
						color: CanvasText;
						background: Canvas;
					}
				`}</style>
				<div
					className={`${
						focus ? "flex flex-1 flex-col" : mode === "split" ? "grid lg:grid-cols-2" : "p-3"
					} mdx-toolbar-wrap text-foreground${focus ? " mdx-focus-mode" : ""}${
						portaled ? " toolbar-portaled" : ""
					}`}
				>
					<div className={`min-w-0${focus ? "" : " lg:pr-8"}`}>
						<MDXEditor
							key={editorKey}
							ref={editorRef}
							markdown={value}
							readOnly={mode === "read"}
							placeholder={t("editor.bodyPlaceholder")}
							contentEditableClassName={`mdx-body-editor ${PROSE_CLS}${
								focus ? " mx-auto w-full max-w-3xl px-4 pt-2" : ""
							}`}
							onChange={(markdown) => {
								lastEmitted.current = markdown;
								onChange(markdown);
							}}
							plugins={plugins}
						/>
					</div>
					{mode === "split" && (
						<div className="min-w-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
							{/* Sağ bölme varsayılan olarak canlı önizleme; kaynak ham
							    markdown (anahtarlar araç çubuğunun sağ ikonlarında). */}
							{splitPane === "preview" ? (
								<div data-pane="preview" className="min-h-[40vh]">
									<MDXEditor
										key={`preview-${previewSeq}`}
										markdown={previewValue}
										readOnly
										contentEditableClassName={`mdx-body-preview ${PROSE_CLS_PREVIEW}`}
										plugins={previewPlugins}
									/>
								</div>
							) : (
								<textarea
									aria-label={t("editor.sourceAria")}
									readOnly
									spellCheck={false}
									value={value}
									className="border-input min-h-[40vh] w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none"
								/>
							)}
						</div>
					)}
				</div>
			</div>
			<SprintDialog
				open={sprintOpen}
				onClose={() => setSprintOpen(false)}
				words={words}
				sprint={sprint}
				typewriter={typewriter}
				onTypewriter={setTypewriter}
				onStart={({ targetWords, durationMin }) => {
					setSprint({
						startedAt: Date.now(),
						endsAt: Date.now() + durationMin * 60_000,
						durationMin,
						targetWords,
						startedWords: words,
					});
					setSprintOpen(false);
				}}
				onEnd={() => {
					setSprint(null);
					setSprintOpen(false);
				}}
			/>
		</div>
	);
}
