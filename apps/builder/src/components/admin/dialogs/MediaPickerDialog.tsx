// Medya seçici — editör alanlarının üstünde açılır; seçilen dosyanın bağı
// $mediaPickTarget'a bırakılan geri çağırmaya teslim edilir.

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { SkeletonGrid } from "@/components/ui-react/skeleton";
import { formatSize, IMAGE_EXT } from "@/lib/admin/format";
import { closeMediaPicker, mediaPreviewUrl, resolveMediaPick, uploadMedia } from "@/lib/admin/media";
import { $media, $mediaLoading } from "@/lib/admin/store";
import { Icon } from "../parts";
import { DialogShell } from "./DialogShell";

export default function MediaPickerDialog() {
	const files = useStore($media);
	const loading = useStore($mediaLoading);
	const [query, setQuery] = useState("");
	const fileInput = useRef<HTMLInputElement>(null);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files).slice(0, 60);
	}, [files, query]);

	return (
		<DialogShell panelClassName="sm:max-w-2xl" onClose={closeMediaPicker}>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold">{t("panel.selectFromMedia")}</h3>
				<div className="flex items-center gap-2">
					<input
						ref={fileInput}
						type="file"
						className="hidden"
						multiple
						onChange={(event) => {
							const picked = event.target.files ? Array.from(event.target.files) : [];
							event.target.value = "";
							if (picked.length) void uploadMedia(picked);
						}}
					/>
					<Button variant="ghost" size="sm" disabled={loading} onClick={() => fileInput.current?.click()}>
						{t("media.upload")}
					</Button>
				</div>
			</div>
			<div className="mt-3">
				<Input
					placeholder={t("dialog.pickerSearch")}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					className="h-8 text-xs"
				/>
			</div>
			<div className="mt-3 max-h-[55vh] overflow-y-auto">
				{loading && filtered.length === 0 ? (
					<SkeletonGrid count={8} className="grid grid-cols-3 gap-2 sm:grid-cols-5" />
				) : (
					<div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
						{filtered.map((item) => (
							<button
								key={item.path}
								type="button"
								title={`${item.path} · ${formatSize(item.size)}`}
								onClick={() => resolveMediaPick(item.path)}
								className="group overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
							>
								<span className="flex h-16 w-full items-center justify-center overflow-hidden bg-muted/30">
									{IMAGE_EXT.test(item.path) ? (
										<img
											src={mediaPreviewUrl(item.path)}
											alt={item.path}
											loading="lazy"
											referrerPolicy="no-referrer"
											className="h-full w-full object-cover"
										/>
									) : (
										<Icon name="file" className="size-5 text-muted-foreground" />
									)}
								</span>
								<span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground group-hover:text-foreground">
									{item.path.split("/").pop()}
								</span>
							</button>
						))}
					</div>
				)}
				{!loading && filtered.length === 0 && (
					<p className="py-8 text-center text-sm text-muted-foreground">{t("media.noMatch")}</p>
				)}
			</div>
		</DialogShell>
	);
}
