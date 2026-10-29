// Medya liste görünümü — Bejamas Table üzerinde GitCMS tablosu: önizleme,
// dosya adı, tür, boyut ve satır içi düzenlenebilir alt metin (D1 meta) + işlemeler.

import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui-react/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui-react/table";
import {
	deleteMedia,
	mediaKindOf,
	mediaLinkFor,
	mediaPreviewUrl,
	setMediaAlt,
	type MediaItem,
} from "@/lib/admin/media";
import { formatSize, IMAGE_EXT } from "@/lib/admin/format";
import { $mediaAlts } from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { Icon } from "../parts";
import { formatBadge } from "./MediaCard";

function AltCell({ item }: { item: MediaItem }) {
	const alts = useStore($mediaAlts);
	const saved = alts[item.path] ?? "";
	const [value, setValue] = useState(saved);
	const [flash, setFlash] = useState(false);
	// Dışarıdan yenilenen değeri (yenileme/yükleme) yansıt.
	useEffect(() => setValue(saved), [saved]);
	const commit = () => {
		if (value.trim() === saved) return;
		void setMediaAlt(item.path, value);
		setFlash(true);
		setTimeout(() => setFlash(false), 1200);
	};
	return (
		<div className="flex items-center gap-1.5">
			<Input
				size="sm"
				placeholder="alt metin ekle…"
				value={value}
				onChange={(event) => setValue(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
					if (event.key === "Escape") {
						event.stopPropagation();
						setValue(saved);
						event.currentTarget.blur();
					}
				}}
				className={`max-w-56 ${flash ? "border-emerald-500/60" : ""}`}
			/>
			{saved && !flash && <Icon name="check" className="size-3.5 shrink-0 text-emerald-600" />}
		</div>
	);
}

function RowAction({
	title,
	icon,
	href,
	variant = "default",
	onClick,
}: {
	title: string;
	icon: string;
	href?: string;
	variant?: "default" | "danger";
	onClick?: () => void;
}) {
	const cls = `flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors ${
		variant === "danger" ? "hover:bg-red-500/10 hover:text-red-600" : "hover:bg-muted hover:text-foreground"
	}`;
	if (href) {
		return (
			<a href={href} target="_blank" rel="noopener" title={title} className={cls}>
				<Icon name={icon} className="size-3.5" />
			</a>
		);
	}
	return (
		<button type="button" title={title} onClick={onClick} className={cls}>
			<Icon name={icon} className="size-3.5" />
		</button>
	);
}

export function MediaList({
	items,
	onOpen,
}: {
	items: MediaItem[];
	onOpen: (item: MediaItem) => void;
}) {
	return (
		<div className="rounded-xl border border-border">
			<Table>
				<TableHeader className="bg-muted/40">
					<TableRow className="hover:bg-transparent">
						<TableHead className="h-9 w-12 px-3 text-xs text-muted-foreground" aria-label={t("media.preview")} />
						<TableHead className="h-9 px-3 text-xs text-muted-foreground">{t("media.fileName")}</TableHead>
						<TableHead className="hidden h-9 px-3 text-xs text-muted-foreground sm:table-cell">{t("media.type")}</TableHead>
						<TableHead className="h-9 px-3 text-xs text-muted-foreground">Boyut</TableHead>
						<TableHead className="hidden h-9 px-3 text-xs text-muted-foreground md:table-cell">Alt metin</TableHead>
						<TableHead className="h-9 w-24 px-3 text-right text-xs text-muted-foreground">{t("media.actions")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((item) => {
						const name = item.path.split("/").pop() ?? item.path;
						const preview = mediaPreviewUrl(item.path);
						const isImage = IMAGE_EXT.test(item.path);
						const mime = mediaKindOf(item.path).mime;
						return (
							<TableRow key={item.path} className="border-border/60 last:border-0">
								<TableCell className="px-3 py-2">
									<button
										type="button"
										onClick={() => onOpen(item)}
										title={isImage ? t("media.enlarge") : t("media.open")}
										className="block size-10 overflow-hidden rounded-lg border border-border bg-muted/40"
									>
										{isImage ? (
											<img
												src={preview}
												alt=""
												loading="lazy"
												referrerPolicy="no-referrer"
												className="size-full object-cover"
											/>
										) : (
											<span className="flex size-full items-center justify-center text-muted-foreground">
												{formatBadge(item.path) || <Icon name="file" className="size-4" />}
											</span>
										)}
									</button>
								</TableCell>
								<TableCell className="max-w-0 px-3 py-2">
									<p className="truncate font-medium" title={item.path}>
										{name}
									</p>
								</TableCell>
								<TableCell className="hidden whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground sm:table-cell">
									{mime}
								</TableCell>
								<TableCell className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
									{formatSize(item.size)}
								</TableCell>
								<TableCell className="hidden px-3 py-2 md:table-cell">
									<AltCell item={item} />
								</TableCell>
								<TableCell className="px-3 py-2">
									<div className="flex justify-end gap-1">
										<RowAction
											title={t("media.copyLink")}
											icon="link"
											onClick={() => void navigator.clipboard?.writeText(mediaLinkFor(item.path))}
										/>
										<RowAction title={t("media.openTab")} icon="external" href={preview} />
										<RowAction
											title="Sil"
											icon="trash"
											variant="danger"
											onClick={() => void deleteMedia(item.path)}
										/>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
