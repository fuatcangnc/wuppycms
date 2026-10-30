/** AI widget kökü — launcher, çekmece, sohbet, canvas ve önizleme köprüsü. */

import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/admin/parts";
import { Button } from "@/components/ui-react/button";
import * as client from "@/lib/admin/agent-client";
import type { AgentStatus } from "@/lib/agent/protocol";
import { refreshEntries, refreshPages } from "@/lib/admin/actions";
import { $doc, $scan, $site, $sites, currentSiteEntry, openDialog } from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { Canvas } from "./Canvas";
import { CanvasBars } from "./CanvasBars";
import { ChatHistory } from "./ChatHistory";
import { ChatLog } from "./ChatLog";
import { Composer } from "./Composer";
import { useAgentChat } from "./hooks/useAgentChat";
import { useElementPicker } from "./hooks/useElementPicker";
import type { ModelChoice, PageItem, PickedElement, Tab } from "./types";

const KEY_OPEN = "wuppycms:agent:open";
const KEY_WIDTH = "wuppycms:agent:width";
const KEY_HISTORY = "wuppycms:agent:history";
const KEY_MODEL = "wuppycms:agent:model";
const MIN_W = 340;
const MAX_W = 760;
const DEFAULT_W = 460;
/** Geçmiş rayı bu genişliğin altında kullanılamaz; varsayılan (460) üstünde. */
const HISTORY_MIN_W = 430;

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function write(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// storage kapalı
	}
}
function sessionRead(key: string): string | null {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}
function sessionWrite(key: string, value: string | null): void {
	try {
		if (value === null) sessionStorage.removeItem(key);
		else sessionStorage.setItem(key, value);
	} catch {
		// storage kapalı
	}
}

function withProtocol(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
	return `https://${trimmed.replace(/\/+$/, "")}`;
}

function pathOf(url: string): string | null {
	try {
		return new URL(url).pathname;
	} catch {
		return url.startsWith("/") ? url : null;
	}
}

/**
 * `*.pages.dev` bazı ağlarda engelli; admin önizlemesi aynı origin'deki
 * `/preview/<proje>/` köprüsünü kullanır (ADR 0021). Kanonik URL değişmez.
 */
function previewUrl(url: string): string {
	try {
		const parsed = new URL(url);
		if (parsed.hostname.endsWith(".pages.dev")) {
			const project = parsed.hostname.slice(0, -".pages.dev".length);
			if (/^wuppy-[a-z0-9-]+$/.test(project)) {
				return `${window.location.origin}/preview/${project}${parsed.pathname === "/" ? "/" : parsed.pathname}${parsed.search}`;
			}
		}
		// AWS siteleri: canlı dev önizlemesi de aynı origin'deki köprüden geçer.
		// Böylece AI düzenlemesi build beklemeden görünür (üretim adresi değişmez).
		const slug = previewSlug(url);
		if (slug) {
			return `${window.location.origin}/preview/${slug}${parsed.pathname === "/" ? "/" : parsed.pathname}${parsed.search}`;
		}
	} catch {
		// göreli URL — olduğu gibi
	}
	return url;
}

/** AWS site adresinden önizleme kimliğini (slug) çıkarır. */
function previewSlug(url: string): string | null {
	try {
		const parsed = new URL(url);
		const match = /^([a-z0-9][a-z0-9-]+)\.sites\.wuppycms\.com$/i.exec(parsed.hostname);
		return match?.[1]?.toLowerCase() ?? null;
	} catch {
		return null;
	}
}

export default function AgentWidget() {
	const site = useStore($site);
	const sites = useStore($sites);
	const scan = useStore($scan);
	const doc = useStore($doc);

	const siteUrl = useMemo(() => {
		const entry = currentSiteEntry();
		const raw = withProtocol(scan?.siteUrl ?? entry?.url ?? "");
		// Yer tutucu adresler gerçek önizleme değildir (eski projelerde kalmış
		// olabilir); boş bırakıp "önizleme yok" durumunu göster.
		if (!raw || /^https?:\/\/(www\.)?example\.(com|org|net)\/?$/i.test(raw)) return "";
		return raw;
	}, [scan?.siteUrl, scan?.setup, sites]);
	const branch = sites.find((entry) => entry.repoFullName === site)?.branch || "main";

	const [open, setOpen] = useState(() => sessionRead(KEY_OPEN) === "1");
	const [width, setWidth] = useState(() => {
		const saved = Number(read(KEY_WIDTH) ?? "");
		return Number.isFinite(saved) && saved >= MIN_W ? Math.min(saved, MAX_W) : DEFAULT_W;
	});
	const [showHistory, setShowHistory] = useState(() => read(KEY_HISTORY) !== "0");
	const [tabs, setTabs] = useState<Tab[]>([]);
	const [activeUrl, setActiveUrl] = useState("");
	const [pages, setPages] = useState<PageItem[]>([]);
	const [status, setStatus] = useState<AgentStatus | null>(null);
	const [insertMode, setInsertMode] = useState(false);
	const [modelId, setModelId] = useState<string | null>(() => read(KEY_MODEL));
	const [reloadNonce, setReloadNonce] = useState(0);
	const [mobilePreview, setMobilePreview] = useState(false);

	const frameRef = useRef<HTMLIFrameElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
	const tabDrag = useRef<string | null>(null);
	const buildBriefLoaded = useRef(false);

	const collapsed = width <= MIN_W + 4;
	const toggleCollapse = () => {
		const next = collapsed ? DEFAULT_W : MIN_W;
		setWidth(clampWidth(next));
		write(KEY_WIDTH, String(clampWidth(next)));
	};

	const models: ModelChoice[] = useMemo(
		() =>
			(status?.models ?? []).map((entry) => ({
				id: entry.id,
				label: entry.label,
				provider: entry.provider as ModelChoice["provider"],
				model: entry.model,
			})),
		[status],
	);
	const model = models.find((entry) => entry.id === modelId) ?? models[0] ?? null;

	// Sağlayıcı ayarında kayıtlı model değiştiyse (ör. Evren'de Qwen) onu seç;
	// kullanıcının elle seçimi ayar değişene kadar korunur.
	const settingsModelRef = useRef<string | null>(null);
	useEffect(() => {
		if (!status?.model || !models.length) return;
		if (settingsModelRef.current === status.model) return;
		settingsModelRef.current = status.model;
		const configured = models.find((entry) => entry.model === status.model);
		if (configured) {
			setModelId(configured.id);
			write(KEY_MODEL, configured.id);
		}
	}, [status?.model, models]);

	// --- canvas sekmeleri ------------------------------------------------------
	useEffect(() => {
		if (!siteUrl) {
			setTabs([]);
			setActiveUrl("");
			return;
		}
		const home = previewUrl(siteUrl);
		setTabs([{ url: home, title: t("widget.home") }]);
		setActiveUrl(home);
	}, [siteUrl, site]);

	useEffect(() => {
		if (!open || !site) return;
		client
			.getAgentPages(site, branch)
			.then((data) => setPages(data.pages))
			.catch(() => setPages([]));
	}, [open, site, branch]);

	useEffect(() => {
		if (!open) return;
		client
			.getAgentStatus()
			.then(setStatus)
			.catch(() => setStatus(null));
	}, [open]);

	useEffect(() => {
		if (!status || !models.length) return;
		// Kayıtlı seçim geçerliyse koru; değilse sağlayıcının modelini seç
		// (ör. Evren gateway'inde gpt-4o-mini olmayabilir).
		if (models.some((entry) => entry.id === modelId)) return;
		const configured = models.find((entry) => entry.model === status.model);
		const chosen = configured ?? models[0]!;
		setModelId(chosen.id);
		write(KEY_MODEL, chosen.id);
	}, [status, models, modelId]);

	const onNavigate = useCallback((href: string) => {
		setTabs((current) => current.map((tab) => (tab.url === activeUrl ? { ...tab, url: href } : tab)));
		setActiveUrl(href);
	}, [activeUrl]);

	const picker = useElementPicker({
		frameRef,
		onNavigate,
	});
	const { showSkeleton, clearSkeleton, softRefresh, setSelectionPosition } = picker;
	const lastTarget = useRef<string | null>(null);

	const reloadCanvas = useCallback(() => {
		if (picker.bridgeReady) picker.command("reload");
		else setReloadNonce((value) => value + 1);
	}, [picker]);

	// Canlı önizlemeyi ısıt: dev sunucusu hazır olunca iframe'i bir kez yenile.
	// İlk açılışta üretim (build'li) site gösterilir; dev hazır olunca geçilir.
	useEffect(() => {
		if (!open || !siteUrl) return;
		const slug = previewSlug(siteUrl);
		if (!slug) return;
		let cancelled = false;
		let timer: number | undefined;
		const poll = async (attempt: number) => {
			if (cancelled) return;
			try {
				const res = await fetch(`/api/preview/status?slug=${encodeURIComponent(slug)}`);
				const data = (await res.json()) as { ready?: boolean };
				if (data.ready) {
					if (!cancelled) reloadCanvas();
					return;
				}
			} catch {
				// yok say
			}
			if (attempt < 40) timer = window.setTimeout(() => void poll(attempt + 1), 2000);
		};
		void (async () => {
			try {
				await fetch("/api/preview/open", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ full_name: site, branch }),
				});
			} catch {
				// yok say
			}
			void poll(0);
		})();
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	}, [open, site, branch, siteUrl, reloadCanvas]);

	const onContentChanged = useCallback(() => {
		// Köprü yoksa tam reload; varsa main'i yumuşak yenile. Böylece her
		// yazma sonrası iframe F5 olmaz, scroll korunur.
		const target = lastTarget.current;
		lastTarget.current = null;
		if (picker.bridgeReady && picker.softRefreshSupported) {
			void softRefresh(target).then((ok) => {
				if (!ok) reloadCanvas();
			});
		} else {
			reloadCanvas();
		}
		void refreshEntries();
		void refreshPages();
	}, [picker.bridgeReady, picker.softRefreshSupported, reloadCanvas, softRefresh]);

	const chat = useAgentChat({
		fullName: site,
		insertMode,
		branch,
		siteUrl: siteUrl || null,
		document: doc ? { collection: doc.collectionKey, path: doc.path } : null,
		pagePath: picker.pagePath ?? pathOf(activeUrl),
		selections: picker.selections,
		model,
		onContentChanged,
		onClearSelections: picker.clearSelections,
		onPromptStart: (context) => {
			const target = context.selections[0];
			lastTarget.current = context.insertMode && target ? target.path : null;
			if (context.insertMode && target && picker.bridgeReady) {
				showSkeleton(target, "Preparing new section");
			}
		},
	});

	const sendWithSkeleton = useCallback(() => {
		chat.send();
	}, [chat.send]);

	const startNewChat = useCallback(() => {
		lastTarget.current = null;
		setInsertMode(false);
		clearSkeleton();
		chat.openSession(null);
	}, [chat.openSession, clearSkeleton]);

	const selectSession = useCallback(
		(id: string) => {
			lastTarget.current = null;
			setInsertMode(false);
			clearSkeleton();
			chat.openSession(id);
		},
		[chat.openSession, clearSkeleton],
	);

	const changePosition = useCallback(
		(selection: PickedElement, position: "before" | "after") => {
			setSelectionPosition(selection.path, selection.label, position);
		},
		[setSelectionPosition],
	);

	useEffect(() => {
		if (!open || !chat.busy) clearSkeleton();
	}, [open, chat.busy, clearSkeleton]);

	useEffect(() => {
		if (buildBriefLoaded.current || !site) return;
		const url = new URL(window.location.href);
		const raw = sessionStorage.getItem("wuppycms:build:brief");
		if (!raw) return;
		buildBriefLoaded.current = true;
		sessionStorage.removeItem("wuppycms:build:brief");
		url.searchParams.delete("build");
		window.history.replaceState({}, "", url);
		try {
			const data = JSON.parse(raw) as {
				prompt?: string;
				siteName?: string;
				tagline?: string;
				color?: string;
				answers?: Array<{
					question: string;
					answer?: string;
					selected?: string[];
					custom?: string;
				}>;
			};
			const answerLines = (data.answers ?? []).map((entry) => {
				const val =
					entry.answer ||
					[...(entry.selected ?? []), entry.custom?.trim()].filter(Boolean).join(", ");
				return `- ${entry.question}: ${val || "belirtilmedi"}`;
			});
			const text = [
				`Site "${data.siteName ?? "yeni site"}" için oluşturuldu.`,
				`Slogan: ${data.tagline ?? ""}`,
				`Renk: ${data.color ?? ""}`,
				"",
				"Brief:",
				data.prompt ?? "",
				"",
				"Cevaplar:",
				...answerLines,
				"",
				"İlk içerikler, hizmetler ve başlıklar siteye otomatik işlendi. Sitede gereksiz 64 adımlık dosya taraması yapma; yalnızca dosyaları doğrula ve kullanıcıya ne hazırlandığını tek mesajda Türkçe özetle.",
			].join("\n");
			setOpen(true);
			chat.setDraft("");
			// "With AI" akışından gelindiyse özeti başlat.
			window.setTimeout(() => {
				chat.send(text);
			}, 700);
		} catch {
			// bozuk brief — sessizce yeni sohbet
		}
	}, [site, chat.setDraft]);

	useEffect(() => {
		if (open) chat.refreshSessions();
	}, [open, site, chat.refreshSessions]);

	// Escape: popover yoksa widget'ı kapat.
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (document.querySelector(":popover-open")) return;
			setOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open]);

	useEffect(() => {
		if (open) {
			sessionWrite(KEY_OPEN, "1");
		} else {
			sessionWrite(KEY_OPEN, null);
			setMobilePreview(false);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onReload = () => reloadCanvas();
		window.addEventListener("wuppycms:agent:reload", onReload);
		return () => window.removeEventListener("wuppycms:agent:reload", onReload);
	}, [open, reloadCanvas]);

	const clampWidth = (value: number) =>
		Math.max(MIN_W, Math.min(MAX_W, Math.min(value, Math.round(window.innerWidth * 0.7))));

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		dragRef.current = { startX: event.clientX, startWidth: width };
		event.currentTarget.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	};
	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag) return;
		setWidth(clampWidth(drag.startWidth + (event.clientX - drag.startX)));
	};
	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		dragRef.current = null;
		write(KEY_WIDTH, String(width));
		event.currentTarget.releasePointerCapture?.(event.pointerId);
	};

	const selectPage = (url: string, title: string) => {
		const absolute = previewUrl(
			url.startsWith("/") && siteUrl ? `${siteUrl}${url}` : url,
		);
		const existing = tabs.find((tab) => tab.url === absolute);
		if (existing) {
			setActiveUrl(absolute);
			return;
		}
		setTabs((current) =>
			current.some((tab) => tab.url === absolute) ? current : [...current, { url: absolute, title }],
		);
		setActiveUrl(absolute);
	};

	const closeTab = (url: string) => {
		setTabs((current) => {
			const next = current.filter((tab) => tab.url !== url);
			if (url === activeUrl) setActiveUrl(next[next.length - 1]?.url ?? "");
			return next;
		});
	};

	const configure = () => {
		setOpen(false);
		openDialog("ai");
	};

	const toggleSelMode = () => {
		if (!picker.bridgeReady) return;
		picker.toggleSelMode();
	};

	const onFrameLoad = useCallback(() => {
		picker.reset();
		picker.handshake();
		// Köprü betiği yükten sonra dinleyici ekleyebilir: selamı birkaç kez yinele.
		const timers = [300, 900, 1800].map((delay) => window.setTimeout(() => picker.handshake(), delay));
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, [picker]);

	if (!open) {
		return (
			<Button
				type="button"
				size="lg"
				className="fixed bottom-5 right-5 z-50 h-11 rounded-full px-4 shadow-lg"
				data-testid="agent-launcher"
				title={t("widget.open")}
				onClick={() => setOpen(true)}
			>
				<Icon name="sparkles" className="size-4" />
				{t("widget.launcher")}
			</Button>
		);
	}

	return (
		<div className="fixed inset-0 z-[70] flex bg-background text-foreground" data-testid="agent-widget">
			<aside
				className="relative flex h-full w-full shrink-0 flex-col border-r border-border bg-background lg:w-[var(--dw)]"
				style={{ "--dw": `${width}px` } as React.CSSProperties}
				role="dialog"
				aria-label={t("widget.agentTitle")}
				aria-modal="false"
			>
				<header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-3">
					<span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
						<Icon name="sparkles" className="size-3.5" />
					</span>
					<span className="mr-1 text-sm font-semibold tracking-tight">{t("widget.agentTitle")}</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						title={showHistory ? t("widget.historyHide") : t("widget.historyShow")}
						aria-pressed={showHistory}
						onClick={() => {
							const next = !showHistory;
							setShowHistory(next);
							write(KEY_HISTORY, next ? "1" : "0");
						}}
					>
						<Icon name="clock" className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						title={collapsed ? t("widget.expand") : t("widget.collapse")}
						aria-pressed={collapsed}
						onClick={toggleCollapse}
					>
						<Icon name="chevron-right" className={`size-4 ${collapsed ? "" : "rotate-180"}`} />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="ml-auto lg:hidden"
						title={t("widget.preview")}
						onClick={() => setMobilePreview(true)}
					>
						<Icon name="eye" className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="lg:hidden"
						title={t("widget.close")}
						aria-label={t("widget.close")}
						onClick={() => setOpen(false)}
					>
						<Icon name="x" className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="hidden lg:inline-flex"
						title={t("widget.closeEsc")}
						aria-label={t("widget.close")}
						onClick={() => setOpen(false)}
					>
						<Icon name="x" className="size-4" />
					</Button>
				</header>

				<div className="flex min-h-0 flex-1">
					{showHistory && width >= HISTORY_MIN_W ? (
						<ChatHistory
							sessions={chat.sessions}
							activeId={chat.activeSessionId}
							loading={chat.sessionsLoading}
							onSelect={selectSession}
							onNew={startNewChat}
						/>
					) : null}
					<div className="flex min-w-0 flex-1 flex-col">
						<ChatLog
							messages={chat.messages}
							tools={chat.tools}
							stream={chat.stream}
							note={chat.note}
							error={chat.error}
							busy={chat.busy}
							elapsed={chat.elapsed}
							undoing={chat.undoing}
							queued={chat.queued}
							loading={chat.sessionLoading}
							onCopy={(text) => void navigator.clipboard?.writeText(text)}
							onEdit={(text) => chat.setDraft(text)}
							onUndoChange={(changeId) => chat.undo(changeId)}
						/>
						<Composer
							draft={chat.draft}
							onDraft={chat.setDraft}
							onSend={sendWithSkeleton}
							busy={chat.busy}
							onStop={chat.stop}
							selections={picker.selections}
							onRemoveSelection={(selection) => picker.toggleSelection(selection)}
							onPositionChange={changePosition}
							insertMode={insertMode}
							onInsertModeChange={setInsertMode}
							queuedCount={chat.queued.length}
							selMode={picker.selMode}
							onToggleSelMode={toggleSelMode}
							bridgeReady={picker.bridgeReady}
							model={model}
							models={models}
							onModelChange={(id) => {
								setModelId(id);
								write(KEY_MODEL, id);
							}}
							configured={Boolean(status?.configured)}
							onConfigure={configure}
							onNewSession={startNewChat}
							onReload={reloadCanvas}
							textareaRef={textareaRef}
						/>
						<p className="border-t border-border px-3 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
							{t("widget.commitNote")}
						</p>
					</div>
				</div>

				<div
					role="separator"
					aria-orientation="vertical"
					aria-label={t("widget.resize")}
					tabIndex={0}
					title={t("widget.resizeHint")}
					className="absolute right-0 top-0 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 lg:block"
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					onDoubleClick={() => setWidth(DEFAULT_W)}
					onKeyDown={(event) => {
						const step = event.shiftKey ? 64 : 16;
						if (event.key === "ArrowLeft") setWidth((value) => clampWidth(value - step));
						else if (event.key === "ArrowRight") setWidth((value) => clampWidth(value + step));
						else return;
						event.preventDefault();
					}}
				/>
			</aside>

			<section
				className={`${mobilePreview ? "fixed inset-0 z-[80] flex" : "hidden"} min-w-0 flex-1 flex-col bg-background lg:static lg:z-auto lg:flex`}
			>
				{mobilePreview ? (
					<div className="flex h-10 shrink-0 items-center justify-end border-b border-border px-2 lg:hidden">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title={t("widget.close")}
							onClick={() => setMobilePreview(false)}
						>
							<Icon name="x" className="size-4" />
						</Button>
					</div>
				) : null}
				<CanvasBars
					tabs={tabs}
					activeUrl={activeUrl}
					pagePath={picker.pagePath}
					pages={pages}
					bridgeReady={picker.bridgeReady}
					selMode={picker.selMode}
					onToggleSelMode={toggleSelMode}
					onActivate={setActiveUrl}
					onCloseTab={closeTab}
					onOpenPages={() => {
						client
							.getAgentPages(site, branch)
							.then((data) => setPages(data.pages))
							.catch(() => undefined);
					}}
					onSelectPage={selectPage}
					onReload={reloadCanvas}
					onBack={() => picker.command("back")}
					onForward={() => picker.command("forward")}
					onFocusComposer={() => textareaRef.current?.focus()}
					onDragStart={(url) => {
						tabDrag.current = url;
					}}
					onDropTab={(url) => {
						const from = tabDrag.current;
						tabDrag.current = null;
						if (!from || from === url) return;
						setTabs((current) => {
							const order = current.map((tab) => tab.url);
							const source = order.indexOf(from);
							const target = order.indexOf(url);
							if (source < 0 || target < 0) return current;
							order.splice(source, 1);
							order.splice(target, 0, from);
							const byUrl = new Map(current.map((tab) => [tab.url, tab]));
							return order.map((item) => byUrl.get(item)!).filter(Boolean);
						});
					}}
				/>
				<Canvas
					tabs={tabs}
					activeUrl={activeUrl}
					frameRef={frameRef}
					reloadNonce={reloadNonce}
					onLoad={onFrameLoad}
					onActivate={setActiveUrl}
				/>
			</section>
		</div>
	);
}
