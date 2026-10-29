// Çöp görünümü (P3) — silinen dosyalar `_trash/` altında yaşar; buradan geri
// yüklenir ya da kalıcı silinir (her ikisi de normal commit — ADR 0006).
// Widget'lar Bejamas portlarıdır (Button, Skeleton).

import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { SkeletonRows } from "@/components/ui-react/skeleton";
import * as api from "@/lib/admin/api";
import { destroyFromTrash, restoreFromTrash } from "@/lib/admin/actions";
import { $site } from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { Icon } from "../parts";

export default function TrashView() {
	const site = useStore($site);
	const [files, setFiles] = useState<string[] | null>(null);
	const [busy, setBusy] = useState("");

	const refresh = async () => {
		if (!site) return;
		setFiles(null);
		try {
			const { entries } = await api.getTree(site);
			setFiles(
				entries
					.filter((entry) => entry.type === "blob" && entry.path.startsWith("_trash/"))
					.map((entry) => entry.path),
			);
		} catch {
			setFiles([]);
		}
	};

	useEffect(() => {
		void refresh();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- site değişince tazele
	}, [site]);

	const act = async (path: string, action: "restore" | "destroy") => {
		setBusy(path);
		try {
			if (action === "restore") await restoreFromTrash(path);
			else await destroyFromTrash(path);
		} finally {
			setBusy("");
			await refresh();
		}
	};

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			<div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
				<h2 className="flex items-baseline gap-2 text-lg font-semibold">
					{t("trash.title")}
					<span className="text-xs font-normal text-muted-foreground">{t("trash.fileCount", { count: files?.length ?? 0 })}</span>
				</h2>
				<p className="text-xs text-muted-foreground">{t("trash.hint")}</p>
			</div>
			<div className="overflow-hidden rounded-xl border border-border">
				{files === null && <SkeletonRows rows={3} />}
				{files?.map((path) => (
					<div
						key={path}
						className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
					>
						<Icon name="trash" className="size-4 shrink-0 text-muted-foreground" />
						<span className="min-w-0 flex-1">
							<span className="block truncate font-mono text-xs">{path.replace(/^_trash\//, "")}</span>
							<span className="block truncate text-[11px] text-muted-foreground">{path}</span>
						</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={busy === path}
							onClick={() => void act(path, "restore")}
						>
							{t("trash.restore")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs text-destructive hover:text-destructive"
							disabled={busy === path}
							onClick={() => void act(path, "destroy")}
						>
							{t("trash.destroy")}
						</Button>
					</div>
				))}
				{files?.length === 0 && (
					<p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("trash.empty")}</p>
				)}
			</div>
		</div>
	);
}
