// Taslak sekmeleri (Wryte "Main / + Draft" paritesi) — makale başına çoklu
// yerel çalışma kopyası. "Main" = repodan gelen içerik (editör durumu);
// taslak sekmeleri IndexedDB'de yaşar, "Kaydet" aktif sekmeyi commit'ler.
//
// Akış kuralları:
// - Main'den ayrılırken mevcut editör durumu belleğe alınır (stash); dönüşte
//   gövde + form + kirli bayrağı aynen geri yüklenir.
// - Taslaktan çıkarken taslak içeriği anında IndexedDB'ye işlenir; taslakta
//   yazarken 600 ms debounce'la yazılır.
// - Taslak aktifken commit olursa (Kaydet) stash commit'lenen içeriğe eşitlenir
//   — Main dönüşü repo ile tutarlı kalır.

import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui-react/button";
import {
	type DraftTab,
	$draftTabActive,
	listDraftTabs,
	newDraftId,
	nextDraftName,
	writeDraftTabs,
} from "@/lib/admin/draft-tabs";
import { $body, $dirty, $doc, $formValues, $site } from "@/lib/admin/store";
import { t } from "@/lib/i18n";

type MainStash = { body: string; values: Record<string, string>; dirty: boolean };

export default function DraftTabs() {
	const doc = useStore($doc);
	const repo = useStore($site);
	const body = useStore($body);
	const values = useStore($formValues);
	const dirty = useStore($dirty);
	const [tabs, setTabs] = useState<DraftTab[]>([]);
	const [activeId, setActiveId] = useState<string>("main");
	const [menuOpen, setMenuOpen] = useState(false);
	const mainStash = useRef<MainStash | null>(null);
	const prevDirty = useRef(false);

	// Doküman değişince: sekmeleri yükle, Main'e dön.
	useEffect(() => {
		if (!doc || !repo) return;
		let alive = true;
		mainStash.current = null;
		setActiveId("main");
		setMenuOpen(false);
		void listDraftTabs(repo, doc.path).then((loaded) => {
			if (alive) setTabs(loaded);
		});
		return () => {
			alive = false;
		};
	}, [repo, doc?.path]);

	// Sekme aktifliğini yedeğe duyur (taslakta yedek otomatiği duraklar).
	useEffect(() => {
		$draftTabActive.set(activeId !== "main");
		return () => {
			$draftTabActive.set(false);
		};
	}, [activeId]);

	// Taslakta yazarken içeriği debounce'la IndexedDB'ye yaz.
	useEffect(() => {
		if (activeId === "main" || !doc || !repo) return;
		const timer = setTimeout(() => {
			setTabs((current) => {
				const next = current.map((tab) =>
					tab.id === activeId ? { ...tab, body, values, updatedAt: Date.now() } : tab,
				);
				void writeDraftTabs(repo, doc.path, next);
				return next;
			});
		}, 600);
		return () => clearTimeout(timer);
	}, [body, values, activeId, doc?.path, repo]);

	// Taslaktayken commit olduysa stash commit'lenen içeriğe eşitlenir
	// (Main dönüşü "repo = Main" tutarlılığını korur).
	useEffect(() => {
		const wasDirty = prevDirty.current;
		prevDirty.current = dirty;
		if (wasDirty && !dirty && activeId !== "main") {
			mainStash.current = { body: $body.get(), values: $formValues.get(), dirty: false };
		}
	}, [dirty, activeId]);

	/** Aktif taslak içeriğini listeye + IndexedDB'ye işle (geçiş öncesi). */
	const flushActive = async (): Promise<DraftTab[]> => {
		if (activeId === "main" || !doc || !repo) return tabs;
		const next = tabs.map((tab) =>
			tab.id === activeId ? { ...tab, body, values, updatedAt: Date.now() } : tab,
		);
		setTabs(next);
		await writeDraftTabs(repo, doc.path, next);
		return next;
	};

	/** Main'e dönerken bellekteki durumu geri yükle. */
	const restoreMain = () => {
		const stash = mainStash.current;
		if (stash) {
			$body.set(stash.body);
			$formValues.set(stash.values);
			$dirty.set(stash.dirty);
		}
		setActiveId("main");
	};

	const switchTo = async (target: string) => {
		if (!doc || target === activeId) return;
		const flushed = await flushActive();
		if (target === "main") {
			restoreMain();
			return;
		}
		// Main'den ayrılırken mevcut durumu sakla (dönüşte geri gelecek).
		if (activeId === "main") {
			mainStash.current = { body: $body.get(), values: $formValues.get(), dirty: $dirty.get() };
		}
		const tab = flushed.find((entry) => entry.id === target);
		if (!tab) return;
		$body.set(tab.body);
		$formValues.set(tab.values);
		$dirty.set(true);
		setActiveId(target);
	};

	const createTab = async (mode: "blank" | "copy") => {
		if (!doc || !repo) return;
		const flushed = await flushActive();
		if (activeId === "main") {
			mainStash.current = { body: $body.get(), values: $formValues.get(), dirty: $dirty.get() };
		}
		const tab: DraftTab = {
			id: newDraftId(),
			name: nextDraftName(
				flushed.map((entry) => entry.name),
				t("drafts.name"),
			),
			body: mode === "copy" ? $body.get() : "",
			values: { ...$formValues.get() },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		const next = [...flushed, tab];
		setTabs(next);
		await writeDraftTabs(repo, doc.path, next);
		$body.set(tab.body);
		$formValues.set(tab.values);
		$dirty.set(true);
		setActiveId(tab.id);
		setMenuOpen(false);
	};

	const deleteTab = async (id: string) => {
		if (!doc || !repo) return;
		const tab = tabs.find((entry) => entry.id === id);
		if (!tab) return;
		if (!window.confirm(t("drafts.confirmDelete", { name: tab.name }))) return;
		const next = tabs.filter((entry) => entry.id !== id);
		setTabs(next);
		await writeDraftTabs(repo, doc.path, next);
		if (activeId === id) restoreMain();
	};

	// Wryte sekme şapkası: aktif sekme ince çerçeveli hap.
	const tabClass = (active: boolean) =>
		`rounded-full px-3 py-0.5 text-xs transition-colors ${
			active
				? "border border-border bg-muted/40 font-medium text-foreground"
				: "text-muted-foreground hover:text-foreground"
		}`;

	return (
		<div className="mb-2 flex flex-wrap items-center gap-1 border-b border-border pb-1.5" data-panel="draft-tabs">
			<button
				type="button"
				className={tabClass(activeId === "main")}
				onClick={() => void switchTo("main")}
			>
				{t("drafts.main")}
			</button>
			{tabs.map((tab) => (
				<span
					key={tab.id}
					className={`${tabClass(activeId === tab.id)} flex items-center gap-1`}
				>
					<button type="button" onClick={() => void switchTo(tab.id)}>
						{tab.name}
					</button>
					<button
						type="button"
						className="text-[11px] opacity-60 hover:opacity-100"
						title={t("drafts.delete")}
						onClick={() => void deleteTab(tab.id)}
					>
						✕
					</button>
				</span>
			))}
			<div className="relative ml-auto">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={() => setMenuOpen((open) => !open)}
				>
					+ {t("drafts.new")}
				</Button>
				{menuOpen && (
					<div className="absolute top-full left-0 z-20 mt-1 grid w-44 gap-0.5 rounded-lg border border-border bg-background p-1 shadow-md">
						<button
							type="button"
							className="rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
							onClick={() => void createTab("blank")}
						>
							{t("drafts.blank")}
						</button>
						<button
							type="button"
							className="rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
							onClick={() => void createTab("copy")}
						>
							{t("drafts.copy")}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
