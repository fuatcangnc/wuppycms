// Doküman listesi — arama, klasör gezinme, commit metalı satırlar.
// P3: Liste / Pano (sürükle-bırak durum) / Takvim görünümleri — adreste taşınır.

import { useStore } from "@nanostores/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { SkeletonRows } from "@/components/ui-react/skeleton";
import { openDoc, setEntriesView, setEntryStatus } from "@/lib/admin/actions";
import type { EntryRow } from "@/lib/admin/api";
import { timeAgo } from "@/lib/admin/format";
import { normalizeStatus } from "@/lib/admin/meta";
import { t } from "@/lib/i18n";
import { $collection, $collections, $entries, $entriesView, $status, openDialog } from "@/lib/admin/store";
import { AvatarCircle, Icon } from "../parts";

const ROW =
	"grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_110px_32px] items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent hover:text-accent-foreground";

/** Pano kolonları — frontmatter `status` değerleri (etiketler i18n anahtarı). */
const BOARD_COLUMNS = [
	{ value: "draft", labelKey: "status.draft" },
	{ value: "review", labelKey: "status.review" },
	{ value: "ready", labelKey: "status.ready" },
] as const;

/** Pano: kartları kolonlara sürükle → status commit'i (setEntryStatus). */
function Board({ entries }: { entries: EntryRow[] }) {
	const dragged = useRef<string | null>(null);
	const [over, setOver] = useState<string | null>(null);

	return (
		<div className="grid gap-3 lg:grid-cols-3">
			{BOARD_COLUMNS.map((column) => {
				const cards = entries.filter((entry) => normalizeStatus(entry.status) === column.value);
				return (
					<div
						key={column.value}
						data-board-column={column.value}
						className={`rounded-xl border border-border p-2 transition-colors ${over === column.value ? "border-primary/40 bg-accent/40" : ""}`}
						onDragOver={(event) => {
							event.preventDefault();
							setOver(column.value);
						}}
						onDragLeave={() => setOver((value) => (value === column.value ? null : value))}
						onDrop={(event) => {
							event.preventDefault();
							const path = event.dataTransfer.getData("text/plain") || dragged.current || "";
							setOver(null);
							dragged.current = null;
							if (path) void setEntryStatus(path, column.value);
						}}
					>
						<div className="mb-2 flex items-center justify-between px-1">
							<span className="text-xs font-medium">{t(column.labelKey)}</span>
							<span className="text-xs text-muted-foreground">{cards.length}</span>
						</div>
						<div className="grid gap-2">
							{cards.map((entry) => (
								<div
									key={entry.path}
									draggable
									onDragStart={(event) => {
										dragged.current = entry.path;
										event.dataTransfer.setData("text/plain", entry.path);
										event.dataTransfer.effectAllowed = "move";
									}}
									onDragEnd={() => {
										dragged.current = null;
									}}
									onClick={() => void openDoc(entry.path)}
									className="cursor-grab rounded-lg border border-border bg-background px-2.5 py-2 shadow-xs transition-colors hover:bg-accent/40 active:cursor-grabbing"
								>
									<span className="block truncate text-sm font-medium">{entry.title}</span>
									<span className="block truncate text-[11px] text-muted-foreground">
										{entry.date || entry.slug}
									</span>
								</div>
							))}
							{cards.length === 0 && (
								<p className="px-1 py-4 text-center text-[11px] text-muted-foreground">{t("common.empty")}</p>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

/** Takvim: `date` alanına göre ay ızgarası; güne tıkla → doküman açılır. */
function Calendar({ entries }: { entries: EntryRow[] }) {
	const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
	const [year, monthNum] = month.split("-").map(Number) as [number, number];
	const first = new Date(Date.UTC(year, monthNum - 1, 1));
	const startDay = (first.getUTCDay() + 6) % 7; // pazartesi başlangıç
	const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
	const cells: (string | null)[] = [
		...Array.from({ length: startDay }, () => null),
		...Array.from(
			{ length: daysInMonth },
			(_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
		),
	];

	const byDay = new Map<string, EntryRow[]>();
	const undated: EntryRow[] = [];
	for (const entry of entries) {
		if (!entry.date) {
			undated.push(entry);
			continue;
		}
		const list = byDay.get(entry.date) ?? [];
		list.push(entry);
		byDay.set(entry.date, list);
	}

	const shift = (delta: number) => {
		const date = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
		setMonth(date.toISOString().slice(0, 7));
	};

	return (
		<div className="overflow-hidden rounded-xl border border-border">
			<div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
				<Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => shift(-1)}>
					←
				</Button>
				<span className="text-sm font-medium">
					{first.toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })}
				</span>
				<Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => shift(1)}>
					→
				</Button>
			</div>
			<div className="grid grid-cols-7 border-b border-border bg-muted/20 text-center text-[11px] text-muted-foreground">
				{t("entries.weekdays").split(",").map((day) => (
					<span key={day} className="py-1">
						{day}
					</span>
				))}
			</div>
			<div className="grid grid-cols-7">
				{cells.map((day, index) => (
					<div key={index} className="min-h-[76px] border-b border-r border-border p-1 [&:nth-child(7n)]:border-r-0">
						{day && <span className="block px-0.5 text-[11px] text-muted-foreground">{Number(day.slice(-2))}</span>}
						{day &&
							(byDay.get(day) ?? []).map((entry) => (
								<button
									key={entry.path}
									type="button"
									onClick={() => void openDoc(entry.path)}
									className="mt-0.5 block w-full truncate rounded bg-accent/60 px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-accent"
									title={entry.title}
								>
									{entry.title}
								</button>
							))}
					</div>
				))}
			</div>
			{undated.length > 0 && (
				<p className="px-3 py-2 text-[11px] text-muted-foreground">
					{t("entries.undated", { count: undated.length })}
				</p>
			)}
		</div>
	);
}

function EntryRowButton({ entry }: { entry: EntryRow }) {
	return (
		<button type="button" className={ROW} onClick={() => void openDoc(entry.path)}>
			<span className="min-w-0">
				<span className="flex items-center gap-2">
					<span className="truncate text-sm font-medium">{entry.title}</span>
					{entry.draft && (
						<span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
							taslak
						</span>
					)}
				</span>
				<span className="block truncate font-mono text-xs text-muted-foreground">{entry.slug}</span>
			</span>
			<span className="truncate text-xs text-muted-foreground">{entry.lastCommit?.message || "—"}</span>
			<span className="truncate text-xs text-muted-foreground">
				{entry.lastCommit ? timeAgo(entry.lastCommit.date) : entry.date || "—"}
			</span>
			<AvatarCircle name={entry.lastCommit?.author ?? "?"} className="size-6 text-[10px]" />
		</button>
	);
}

export default function EntriesView() {
	const collectionKey = useStore($collection);
	const collections = useStore($collections);
	const entries = useStore($entries);
	const status = useStore($status);
	const entriesView = useStore($entriesView);
	const [query, setQuery] = useState("");
	const [folder, setFolder] = useState("");

	const def = collections.find((c) => c.key === collectionKey);
	const base = `${def?.base ?? ""}/`;

	const { folders, files, total, flat } = useMemo(() => {
		const q = query.trim().toLowerCase();
		const all = entries
			.filter((e) => !q || e.title.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q))
			.sort((a, b) =>
				(b.lastCommit?.date ?? b.date ?? "").localeCompare(a.lastCommit?.date ?? a.date ?? ""),
			);
		const foundFolders = new Map<string, number>();
		const foundFiles: EntryRow[] = [];
		for (const entry of all) {
			const rel = entry.path.startsWith(base) ? entry.path.slice(base.length) : entry.slug;
			const scoped = folder ? rel.slice(folder.length) : rel;
			if (!folder || rel.startsWith(folder)) {
				const slash = scoped.indexOf("/");
				if (slash === -1) foundFiles.push(entry);
				else foundFolders.set(scoped.slice(0, slash), (foundFolders.get(scoped.slice(0, slash)) ?? 0) + 1);
			}
		}
		return { folders: foundFolders, files: foundFiles, total: all.length, flat: all };
	}, [entries, query, folder, base]);

	const goUp = () => {
		let next = folder.slice(0, folder.lastIndexOf("/"));
		if (next) next += "/";
		setFolder(next);
	};

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h2 className="flex items-baseline gap-2 text-lg font-semibold">
					{folder && (
						<button type="button" className="text-muted-foreground hover:text-foreground" title={t("entries.up")} onClick={goUp}>
							↩
						</button>
					)}
					<span>{def?.name ?? ""}</span>
					<span className="text-xs font-normal text-muted-foreground">{t("entries.docs", { count: total })}</span>
				</h2>
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
						{(
							[
								["list", t("entries.list")],
								["board", t("entries.board")],
								["calendar", t("entries.calendar")],
							] as const
						).map(([value, label]) => (
							<Button
								key={value}
								type="button"
								variant={entriesView === value ? "default" : "ghost"}
								size="sm"
								className="h-6 px-2 text-[11px]"
								onClick={() => setEntriesView(value)}
							>
								{label}
							</Button>
						))}
					</div>
					<div className="relative">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
						<Input
							placeholder={t("entries.search")}
							size="sm"
							className="w-40 pl-8"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</div>
					<Button size="sm" onClick={() => openDialog("new")}>+ {t("entry.title")}</Button>
				</div>
			</div>
			{entriesView === "board" && <Board entries={flat} />}
			{entriesView === "calendar" && <Calendar entries={flat} />}
			{entriesView === "list" && (
				<div className="overflow-hidden rounded-xl border border-border">
				<div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_110px_32px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
					<span>{t("entries.name")}</span><span>{t("entries.changeNote")}</span><span>{t("entries.updated")}</span><span></span>
				</div>
				<div>
					{folder && (
						<button
							type="button"
							className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_110px_32px] items-center gap-3 border-b border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/40"
							onClick={goUp}
						>
							{t("entries.parent")}
						</button>
					)}
					{[...folders.entries()].sort().map(([name, count]) => (
						<button
							key={name}
							type="button"
							className={ROW}
							onClick={() => setFolder(`${folder}${name}/`)}
						>
							<span className="flex min-w-0 items-center gap-2">
								<Icon name="folder" className="size-4 text-muted-foreground" />
								<span className="truncate text-sm font-medium">{name}</span>
								<span className="text-xs text-muted-foreground">{count}</span>
							</span>
							<span /><span /><span />
						</button>
					))}
					{files.map((entry) => (
						<EntryRowButton key={entry.path} entry={entry} />
					))}
					{status === "loading" && entries.length === 0 && <SkeletonRows rows={5} />}
					{status !== "loading" && folders.size === 0 && files.length === 0 && (
						<p className="px-3 py-6 text-center text-sm text-muted-foreground">
							{t("entries.empty")}
						</p>
					)}
					</div>
				</div>
			)}
		</div>
	);
}
