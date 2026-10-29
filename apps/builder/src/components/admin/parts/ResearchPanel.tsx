// Araştırma paneli (Wryte "Research" paritesi) — makale başına not/kaynak
// listesi; repo'da `.wuppycms/research/…` yaşar (ADR 0006 repo-only). Bağlantı
// önerileri: koleksiyondaki diğer yazılar; tıklayınca gövdeye markdown
// bağlantısı eklenir (editör köprüsü üzerinden, mdxeditor'a dokunmadan).

import { useStore } from "@nanostores/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { Icon } from "../parts";
import { loadResearchNotes, saveResearchNotes } from "@/lib/admin/actions";
import * as api from "@/lib/admin/api";
import { insertMarkdownIntoEditor } from "@/lib/admin/editor-bridge";
import { researchPathFor } from "@/lib/admin/research";
import { $body, $collection, $doc, $entries, $site } from "@/lib/admin/store";
import { t } from "@/lib/i18n";

export default function ResearchPanel({ onClose }: { onClose?: () => void }) {
	const doc = useStore($doc);
	const body = useStore($body);
	const entries = useStore($entries);
	const collection = useStore($collection);
	const repo = useStore($site);
	const [notes, setNotes] = useState<string[]>([]);
	const [draft, setDraft] = useState("");
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	// Wryte düzeni: not ekleme satırı "+ Araştırma ekle" ile açılır.
	const [composerOpen, setComposerOpen] = useState(false);

	// Doküman değişince notları repo'dan yükle (dosya yoksa boş).
	useEffect(() => {
		if (!doc) return;
		let alive = true;
		setNotes([]);
		setDirty(false);
		setDraft("");
		void loadResearchNotes(researchPathFor(doc.path)).then((loaded) => {
			if (alive) setNotes(loaded);
		});
		return () => {
			alive = false;
		};
	}, [doc?.path]);

	// Derin bağlantıyla açılan dokümanda giriş listesi boş olabilir — öneriler
	// için koleksiyon listesini Query üzerinden bir kez çek (paylaşılan store'a
	// dokunmadan).
	const { data } = useQuery({
		queryKey: ["research-entries", repo, collection],
		queryFn: () => api.getEntries(repo, collection),
		enabled: Boolean(repo && collection && entries.length === 0),
		staleTime: 30_000,
	});
	const rows = entries.length > 0 ? entries : (data?.entries ?? []);

	const addNote = () => {
		const text = draft.trim();
		if (!text) return;
		setNotes((current) => [...current, text]);
		setDraft("");
		setDirty(true);
	};

	const removeNote = (index: number) => {
		setNotes((current) => current.filter((_, i) => i !== index));
		setDirty(true);
	};

	const save = async () => {
		setSaving(true);
		const ok = await saveResearchNotes(notes);
		setSaving(false);
		if (ok) setDirty(false);
	};

	// Zaten gövdede bağlantısı olan yazılar önerilmez.
	const suggestions = rows
		.filter((entry) => entry.path !== doc?.path && !body.includes(entry.slug))
		.slice(0, 6);

	return (
		<div data-panel="research">
			<div className="mb-3 flex items-center justify-between gap-2">
				<p className="text-sm font-medium text-foreground">
					{t("research.title")}
					{notes.length > 0 ? ` (${notes.length})` : ""}
				</p>
				{onClose && (
					<button
						type="button"
						className="text-[11px] text-muted-foreground hover:text-foreground"
						title={t("common.close")}
						onClick={onClose}
					>
						✕
					</button>
				)}
			</div>
			<div className="grid gap-2">
				<button
					type="button"
					className="border-border w-full rounded-lg border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
					onClick={() => setComposerOpen((current) => !current)}
				>
					{t("research.addOpen")}
				</button>
				{composerOpen && (
					<div className="flex items-center gap-1.5">
						<Input
							size="sm"
							className="h-7"
							aria-label={t("research.placeholder")}
							placeholder={t("research.placeholder")}
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									addNote();
								}
							}}
						/>
						<Button
							type="button"
							size="sm"
							className="h-7 px-2.5 text-xs"
							disabled={!draft.trim()}
							onClick={addNote}
						>
							{t("research.add")}
						</Button>
					</div>
				)}
				{notes.length === 0 ? (
					<p className="text-[11px] text-muted-foreground">{t("research.empty")}</p>
				) : (
					<ul className="grid gap-1">
						{notes.map((note, index) => (
							<li
								key={`${index}-${note}`}
								className="flex items-start gap-1.5 rounded-md bg-muted/30 px-2 py-1"
							>
								<span className="min-w-0 flex-1 break-words text-xs">{note}</span>
								<button
									type="button"
									className="text-[11px] text-muted-foreground hover:text-foreground"
									title={t("research.deleteNote")}
									onClick={() => removeNote(index)}
								>
									✕
								</button>
							</li>
						))}
					</ul>
				)}
				{dirty && (
					<Button
						type="button"
						size="sm"
						className="h-7 justify-self-start px-2.5 text-xs"
						data-testid="research-save"
						disabled={saving}
						onClick={() => void save()}
					>
						{saving ? t("research.saving") : t("research.save")}
					</Button>
				)}
				<div className="mt-1 border-t border-border pt-3">
					<p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
						<Icon name="link" className="size-3.5 text-muted-foreground" />
						{t("research.suggestions")}
					</p>
					{suggestions.length === 0 ? (
						<p className="text-[11px] text-muted-foreground">{t("research.suggestionsEmpty")}</p>
					) : (
						<ul className="grid gap-0.5">
							{suggestions.map((entry) => (
								<li key={entry.path}>
									<button
										type="button"
										className="w-full truncate rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
										title={t("research.insertLink")}
										onClick={() =>
											insertMarkdownIntoEditor(`[${entry.title}](/${collection}/${entry.slug})`)
										}
									>
										{entry.title}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
