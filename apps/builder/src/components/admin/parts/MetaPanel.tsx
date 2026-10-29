// Sağ panel (P1+P2) — frontmatter'ın üç görünümü + sürüm geçmişi + hazırlık +
// ön izlemeler. Görsel: alan formu · YAML: elle düzenle → Uygula · MD: tam
// dosya · Geçmiş: sürümler + diff + "Anlık görüntü".
// Widget'lar Bejamas portlarıdır (Input, Textarea, Tabs, Button, Dialog).

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CommitInfo } from "@wuppycms/shared";
import { Button } from "@/components/ui-react/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-react/tabs";
import { Textarea } from "@/components/ui-react/textarea";
import * as api from "@/lib/admin/api";
import { loadDocText, setDocField, setFormValue, takeSnapshot } from "@/lib/admin/actions";
import { diffLines, diffStats } from "@/lib/admin/diff";
import { isMediaField, specFor } from "@/lib/admin/fields";
import { buildControls, type ControlSpec } from "@/lib/admin/form";
import { displayToRaw, parseDoc, rawToDisplay } from "@/lib/admin/frontmatter";
import { mediaPreviewUrl } from "@/lib/admin/media-core";
import { pickMedia } from "@/lib/admin/media";
import { ogFieldName, normalizeStatus, readiness, searchPreview } from "@/lib/admin/meta";
import { parsePublishAt } from "@/lib/schedule";
import {
	$body,
	$dirty,
	$doc,
	$formValues,
	$media,
	currentCollection,
	currentSite,
	currentSiteEntry,
	mediaRelPath,
} from "@/lib/admin/store";

const TEXTAREA_CLS =
	"border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3";
const SELECT_CLS =
	"border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full appearance-none rounded-lg border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3";

/** Şema güdümlü tek alan (DocView'dan taşındı). */
function Field({ control, value }: { control: ControlSpec; value: string }) {
	const spec = specFor(control.type);
	return (
		<div className="grid gap-1.5">
			<label className="block text-xs font-medium text-muted-foreground" title={control.label.endsWith(" *") ? t("panel.notInSchema") : undefined}>
				{control.label}
			</label>
			{spec.widget === "switch" ? (
				<div className="flex h-9 items-center">
					<input
						type="checkbox"
						className="size-4 accent-primary"
						checked={value === "true"}
						onChange={(event) => setFormValue(control.name, event.target.checked ? "true" : "false")}
					/>
				</div>
			) : spec.widget === "select" ? (
				<select className={SELECT_CLS} value={value} onChange={(event) => setFormValue(control.name, event.target.value)}>
					{!control.required && <option value="" />}
					{(control.options ?? []).map((option) => (
						<option key={option} value={option}>{option}</option>
					))}
				</select>
			) : spec.widget === "textarea" ? (
				<textarea
					rows={control.type === "json" ? 2 : 3}
					spellCheck={false}
					className={`${TEXTAREA_CLS} ${control.type === "json" ? "font-mono text-xs" : ""}`}
					value={value}
					onChange={(event) => setFormValue(control.name, event.target.value)}
				/>
			) : (
				<div className="grid gap-1.5">
					<Input
						type={
							spec.widget === "date"
								? "date"
								: spec.widget === "datetime"
									? "datetime-local"
									: spec.widget === "number"
										? "number"
										: "text"
						}
						placeholder={control.type === "string[]" ? t("panel.tagsPlaceholder") : undefined}
						value={value}
						onChange={(event) => setFormValue(control.name, event.target.value)}
					/>
					{spec.widget === "input" && isMediaField(control.name, value) && (
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => pickMedia((link) => setDocField(control.name, link))}
							>
								{t("panel.selectFromMedia")}
							</Button>
							{/^https?:\/\//.test(value.trim()) && (
								<img src={value.trim()} alt="" className="h-7 w-7 rounded border border-border object-cover" />
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function SectionTitle({ label, hint }: { label: string; hint?: string }) {
	return (
		<div className="mb-1.5 flex items-baseline justify-between gap-2">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			{hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
		</div>
	);
}

export default function MetaPanel({ controls }: { controls: ControlSpec[] }) {
	const doc = useStore($doc);
	const values = useStore($formValues);
	const body = useStore($body);
	const media = useStore($media);
	const entry = currentSiteEntry();

	// YAML: kullanıcı düzenlerken canlı türetimi ez; Uygula/Vazgeç ile dön.
	const [yamlDraft, setYamlDraft] = useState<string | null>(null);
	const [tab, setTab] = useState("visual");

	// P2 — Geçmiş: dokümanın sürümleri (path'e göre commit'ler) + seçili sürümün
	// içeriği; diff, "şu anki" metinle karşılaştırılır.
	const repo = currentSite()?.repoFullName;
	const dirty = useStore($dirty);
	const [selected, setSelected] = useState<CommitInfo | null>(null);
	const [snapshotNote, setSnapshotNote] = useState("");
	const commitsQuery = useQuery({
		queryKey: ["docCommits", repo, doc?.path],
		queryFn: () => api.listCommits(repo!, { path: doc!.path, perPage: 20 }),
		enabled: Boolean(repo && doc),
	});
	const oldQuery = useQuery({
		queryKey: ["docFileAt", repo, doc?.path, selected?.sha],
		queryFn: () => api.getFile(repo!, doc!.path, selected!.sha),
		enabled: Boolean(repo && doc && selected),
	});

	const yamlLive = useMemo(() => {
		if (!doc) return "";
		const byName = new Map(controls.map((control) => [control.name, control]));
		const lines = doc.order.map((key) => {
			const control = byName.get(key);
			const raw = control ? displayToRaw(values[key] ?? "", control.type) : (doc.values.get(key) ?? "");
			return `${key}: ${raw}`;
		});
		// Henüz dosyada olmayan ama dolu şema alanları da kayıtta yazılacak — göster.
		for (const control of controls) {
			if (doc.order.includes(control.name)) continue;
			if ((values[control.name] ?? "").trim() === "") continue;
			lines.push(`${control.name}: ${displayToRaw(values[control.name] ?? "", control.type)}`);
		}
		return lines.join("\n");
	}, [doc?.path, doc?.order.join(","), controls, values]);

	const applyYaml = () => {
		if (!doc || yamlDraft === null) return;
		const parsed = parseDoc(`---\n${yamlDraft}\n---\n`);
		const nextDoc = { ...doc, order: parsed.order, values: parsed.values };
		$doc.set(nextDoc);
		const nextValues: Record<string, string> = {};
		for (const control of buildControls(currentCollection(), nextDoc)) {
			nextValues[control.name] = rawToDisplay(nextDoc.values.get(control.name), control.type);
		}
		$formValues.set(nextValues);
		setYamlDraft(null);
	};

	// Şu anki dosya metni (diff'in "yeni" tarafı) + seçili sürümle satır diff'i.
	const currentText = useMemo(() => `---\n${yamlLive}\n---\n${body}`, [yamlLive, body]);
	const diffRows = useMemo(
		() => (oldQuery.data ? diffLines(oldQuery.data.content, currentText) : []),
		[oldQuery.data, currentText],
	);
	const diff = useMemo(() => diffStats(diffRows), [diffRows]);

	const onSnapshot = async () => {
		setSnapshotNote("");
		const ok = await takeSnapshot();
		setSnapshotNote(ok ? t("panel.snapshotTaken") : dirty ? t("panel.snapshotFailed") : t("panel.snapshotNoChange"));
		void commitsQuery.refetch();
	};

	if (!doc) return null;

	const fields = controls.filter((control) => control.name !== "title" && control.name !== "status");
	const score = readiness(values, body);
	const preview = searchPreview({ siteUrl: entry?.url, docPath: doc.path, values });

	// OG görseli: alan değeri medya kütüphanesindeki bir dosyaya denk geliyorsa
	// önizleme (repo → raw, R2 → public); harici URL değeri doğrudan gösterilir.
	const ogName = ogFieldName(controls);
	const ogValue = ogName ? (values[ogName] ?? "").trim() : "";
	const ogRel = ogValue.replace(/^\/+/, "");
	const ogItem = ogValue && !/^https?:\/\//.test(ogValue) ? media.find((item) => mediaRelPath(item.path) === ogRel) : undefined;
	const ogPreview = ogValue ? (/^https?:\/\//.test(ogValue) ? ogValue : ogItem ? mediaPreviewUrl(ogItem.path) : null) : null;

	// P4 — Zamanlama: `publishAt` frontmatter'ı; yürütücü (Cron ya da
	// POST /api/schedule/run) zamanı gelince `status: ready` yapar (ADR 0006).
	const publishAtValue = (values["publishAt"] ?? "").trim().replace(" ", "T").slice(0, 16);
	const publishAtDate = parsePublishAt(values["publishAt"]);
	const statusNow = normalizeStatus(values["status"]);
	const publishState = !publishAtDate
		? { hint: "—", text: t("panel.scheduleNotSet") }
		: publishAtDate.getTime() <= Date.now()
			? statusNow === "ready"
				? { hint: "yayında", text: t("panel.schedulePublished", { date: publishAtDate.toLocaleString("tr-TR") }) }
				: { hint: "bekliyor", text: t("panel.scheduleDue", { date: publishAtDate.toLocaleString("tr-TR") }) }
			: { hint: "planlı", text: t("panel.schedulePlanned", { date: publishAtDate.toLocaleString("tr-TR") }) };

	return (
		<div className="grid gap-5">
			<Tabs value={tab} onValueChange={setTab}>
				<TabsList>
					<TabsTrigger value="visual">{t("meta.visual")}</TabsTrigger>
					<TabsTrigger value="yaml">{t("meta.yaml")}</TabsTrigger>
					<TabsTrigger value="md">{t("meta.md")}</TabsTrigger>
					<TabsTrigger value="history">{t("meta.history")}</TabsTrigger>
				</TabsList>
				<TabsContent value="visual">
					<div className="grid gap-4 pt-2">
						{fields.length === 0 && (
							<p className="text-xs text-muted-foreground">{t("panel.fieldsEmpty")}</p>
						)}
						{fields.map((control) => (
							<Field key={control.name} control={control} value={values[control.name] ?? ""} />
						))}
					</div>
				</TabsContent>
				<TabsContent value="yaml">
					<div className="grid gap-2 pt-2">
						<Textarea
							aria-label="Frontmatter YAML"
							spellCheck={false}
							className="min-h-[220px] font-mono text-xs"
							value={yamlDraft ?? yamlLive}
							onChange={(event) => setYamlDraft(event.target.value)}
						/>
						<div className="flex items-center gap-2">
							<Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={yamlDraft === null} onClick={applyYaml}>
								{t("panel.apply")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								disabled={yamlDraft === null}
								onClick={() => setYamlDraft(null)}
							>
								{t("panel.revert")}
							</Button>
							{yamlDraft !== null && <span className="text-[11px] text-amber-600">{t("panel.yamlEdited")}</span>}
						</div>
					</div>
				</TabsContent>
				<TabsContent value="md">
					<div className="pt-2">
						<Textarea
							aria-label="Tam dosya"
							readOnly
							spellCheck={false}
							className="min-h-[260px] font-mono text-xs"
							value={`---\n${yamlLive}\n---\n${body}`}
						/>
						<p className="mt-1 text-[11px] text-muted-foreground/70">{t("panel.mdReadonly")}</p>
					</div>
				</TabsContent>
				<TabsContent value="history">
					<div className="grid gap-2 pt-2">
						<div className="flex items-center justify-between gap-2">
							<span className="text-[11px] text-muted-foreground">
								{t("panel.versions", { count: commitsQuery.data?.commits.length ?? 0 })}
							</span>
							<Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => void onSnapshot()}>
								{t("meta.snapshot")}
							</Button>
						</div>
						{snapshotNote && <p className="text-[11px] text-muted-foreground">{snapshotNote}</p>}
						<ul className="grid gap-1">
							{commitsQuery.isLoading && <li className="text-xs text-muted-foreground">{t("common.loading")}</li>}
							{(commitsQuery.data?.commits ?? []).map((commit) => (
								<li key={commit.sha}>
									<button
										type="button"
										className="w-full rounded-md border border-border px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
										onClick={() => {
											setSnapshotNote("");
											setSelected(commit);
										}}
									>
										<span className="block truncate text-xs">{commit.message.split("\n")[0]}</span>
										<span className="block truncate text-[11px] text-muted-foreground">
											{new Date(commit.date).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
											{commit.authorName} · {commit.sha.slice(0, 7)}
										</span>
									</button>
								</li>
							))}
						</ul>
						<p className="text-[11px] text-muted-foreground/70">
							{t("panel.historyHint")}
						</p>
					</div>
				</TabsContent>
			</Tabs>

			<div>
				<SectionTitle label={t("meta.readiness")} hint={`${score.score}/100`} />
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
					<div
						className={`h-full rounded-full transition-all ${score.score >= 80 ? "bg-emerald-500" : score.score >= 50 ? "bg-amber-500" : "bg-primary"}`}
						style={{ width: `${score.score}%` }}
					/>
				</div>
				<ul className="mt-2 grid gap-1">
					{score.items.map((item) => (
						<li key={item.key} className={`text-xs ${item.done ? "text-muted-foreground" : "text-foreground/70"}`}>
							<span className={item.done ? "text-emerald-600" : "text-muted-foreground/50"}>{item.done ? "✓" : "○"}</span>{" "}
							{t(item.label)}
						</li>
					))}
				</ul>
			</div>

			<div>
				<SectionTitle label={t("meta.searchPreview")} hint={t("panel.searchHint")} />
				<div className="rounded-lg border border-border p-3">
					<p className="truncate text-xs text-emerald-700 dark:text-emerald-400">{preview.url}</p>
					<p className="mt-0.5 truncate text-sm font-medium text-[#1a0dab] dark:text-[#8ab4f8]">{preview.title}</p>
					<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
						{preview.description || t("panel.searchEmpty")}
					</p>
				</div>
			</div>

			<div>
				<SectionTitle label={t("meta.socialCard")} hint={ogName ? ogName : undefined} />
				{ogName ? (
					<div className="grid gap-2">
						<Input
							value={ogValue}
							onChange={(event) => setFormValue(ogName, event.target.value)}
							placeholder={t("panel.ogPlaceholder")}
						/>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => pickMedia((link) => setDocField(ogName, link))}
							>
								{t("panel.selectFromMedia")}
							</Button>
							{ogValue && <span className="truncate text-[11px] text-muted-foreground">{ogValue}</span>}
						</div>
						<div className="overflow-hidden rounded-lg border border-border">
							{ogPreview ? (
								<img src={ogPreview} alt="" className="h-36 w-full object-cover" />
							) : (
								<div className="flex h-36 w-full items-center justify-center bg-muted text-xs text-muted-foreground">
									{ogValue ? t("panel.ogNotFound") : t("panel.ogNone")}
								</div>
							)}
							<div className="border-t border-border p-2">
								<p className="truncate text-xs font-medium">{preview.title}</p>
								<p className="truncate text-[11px] text-muted-foreground">{preview.description || preview.url}</p>
							</div>
						</div>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">
						{t("panel.ogNoField")}
					</p>
				)}
			</div>

			<div>
				<SectionTitle label={t("meta.schedule")} hint={publishState.hint} />
				<Input
					type="datetime-local"
					aria-label={t("panel.publishAtLabel")}
					value={publishAtValue}
					onChange={(event) => setDocField("publishAt", event.target.value)}
				/>
				<p className="mt-1 text-[11px] text-muted-foreground">{publishState.text}</p>
			</div>

			{/* P2 — sürüm karşılaştırması: seçili commit'in içeriği ↔ şu anki metin */}
			<Dialog open={selected !== null} onClose={() => setSelected(null)}>
				<DialogOverlay />
				<DialogContent className="sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t("panel.diffTitle")}</DialogTitle>
						<DialogDescription>
							{selected
								? `${selected.message.split("\n")[0]} · ${selected.sha.slice(0, 7)} · +${diff.added} −${diff.removed}`
								: ""}
						</DialogDescription>
					</DialogHeader>
					{oldQuery.isLoading ? (
						<p className="text-xs text-muted-foreground">{t("panel.diffLoading")}</p>
					) : oldQuery.isError ? (
						<p className="text-xs text-destructive">{t("panel.diffFailed")}</p>
					) : (
						<pre className="max-h-[50vh] overflow-auto rounded-md border border-border p-2 font-mono text-xs leading-5">
							{diffRows.slice(0, 600).map((row, index) => (
								<div
									key={index}
									className={
										row.type === "add"
											? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
											: row.type === "del"
												? "bg-red-500/10 text-red-900 dark:text-red-200"
												: ""
									}
								>
									<span className="mr-2 inline-block w-3 select-none text-muted-foreground/60">
										{row.type === "add" ? "+" : row.type === "del" ? "−" : " "}
									</span>
									{row.text || " "}
								</div>
							))}
							{diffRows.length > 600 && (
								<div className="text-muted-foreground">{t("panel.moreLines", { count: diffRows.length - 600 })}</div>
							)}
						</pre>
					)}
					<DialogFooter className="flex flex-row items-center justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 px-3 text-xs"
							onClick={() => setSelected(null)}
						>
							Kapat
						</Button>
						<Button
							type="button"
							size="sm"
							className="h-8 px-3 text-xs"
							disabled={!oldQuery.data}
							onClick={() => {
								if (oldQuery.data) loadDocText(oldQuery.data.content);
								setSelected(null);
							}}
						>
							{t("panel.diffLoad")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
