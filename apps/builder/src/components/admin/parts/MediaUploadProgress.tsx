// Yükleme ilerleme şeridi — hangi dosyanın ne aşamada olduğunu, giden baytı,
// yüzdeli toplam çubuğu ve hızdan hesaplanan tahmini kalan süreyi gösterir.
// Oturumu $mediaUpload'a media.ts (uploadMedia / createMediaFolder) yazar.

import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { formatSize } from "@/lib/admin/format";
import { $mediaUpload, type UploadPhase } from "@/lib/admin/store";

const PHASE_LABEL: Record<UploadPhase, string> = {
	queue: "sırada",
	prepare: "hazırlanıyor…",
	send: "gönderiliyor",
	server: "commit bekleniyor…",
	done: "yüklendi ✓",
	error: "başarısız ✗",
};

function formatEta(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "az kaldı";
	if (seconds < 60) return `~${Math.ceil(seconds)} sn`;
	return `~${Math.floor(seconds / 60)} dk ${Math.round(seconds % 60)} sn`;
}

export function MediaUploadProgress() {
	const session = useStore($mediaUpload);
	const active = session !== null;
	// Hız/kalan süre olaylardan bağımsız işlemeli; periyodik tik bunu besler.
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [active]);

	if (!session) return null;

	const total = session.files.reduce((sum, f) => sum + f.size, 0);
	const sent = session.files.reduce((sum, f) => sum + f.size * (f.phase === "done" ? 1 : f.frac), 0);
	const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
	const elapsed = session.sendStartedAt ? (now - session.sendStartedAt) / 1000 : 0;
	const speed = elapsed > 0.4 ? sent / elapsed : 0; // gönderim oturmadan hız uydurmayız
	const eta = speed > 0 && sent < total ? (total - sent) / speed : null;
	const doneCount = session.files.filter((f) => f.phase === "done").length;

	return (
		<div className="sticky top-0 z-30 border-b border-border bg-background/95 px-6 py-2.5 backdrop-blur">
			<div className="mx-auto w-full max-w-4xl">
				<div className="flex items-center justify-between gap-3 text-xs">
					<span className="font-medium">
						{session.message ?? `${doneCount}/${session.files.length} dosya yüklendi · yükleniyor…`}
					</span>
					{!session.message && (
						<span className="shrink-0 tabular-nums text-muted-foreground">
							{formatSize(sent)} / {formatSize(total)} · %{pct}
							{eta !== null ? ` · ${formatEta(eta)} kaldı` : ""}
						</span>
					)}
				</div>
				<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
					{session.message ? (
						<div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
					) : (
						<div
							className="h-full rounded-full bg-primary transition-[width] duration-300"
							style={{ width: `${Math.max(2, pct)}%` }}
						/>
					)}
				</div>
				{!session.message && (
					<ul className="mt-1.5 grid gap-0.5">
						{session.files.slice(0, 5).map((file, index) => (
							<li
								key={`${file.name}:${index}`}
								className="flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground"
							>
								<span className="truncate font-mono">{file.name}</span>
								<span
									className={`shrink-0 tabular-nums ${
										file.phase === "error"
											? "text-destructive"
											: file.phase === "done"
												? "text-foreground"
												: ""
									}`}
								>
									{PHASE_LABEL[file.phase]}
									{file.phase === "send" ? ` %${Math.round(file.frac * 100)}` : ""}
									{(file.phase === "queue" || file.phase === "prepare" || file.phase === "send") &&
										` · ${formatSize(file.size)}`}
								</span>
							</li>
						))}
						{session.files.length > 5 && (
							<li className="text-[11px] text-muted-foreground">+{session.files.length - 5} dosya daha…</li>
						)}
					</ul>
				)}
			</div>
		</div>
	);
}
