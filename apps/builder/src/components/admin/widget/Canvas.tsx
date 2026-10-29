/** Canvas: önizleme pencereleri (en fazla iki) — etkin olan etkileşimli. */

import { useEffect, useState } from "react";
import { Icon } from "@/components/admin/parts";
import { Skeleton } from "@/components/ui-react/skeleton";
import { t } from "@/lib/i18n";
import type { Tab } from "./types";

export interface CanvasProps {
	tabs: Tab[];
	activeUrl: string;
	frameRef: React.RefObject<HTMLIFrameElement | null>;
	reloadNonce: number;
	onLoad(): void;
	onActivate(url: string): void;
}

function withNonce(url: string, nonce: number): string {
	if (!nonce) return url;
	const next = new URL(url, window.location.origin);
	next.searchParams.set("_wuppycms", String(nonce));
	return next.toString();
}

export function Canvas({ tabs, activeUrl, frameRef, reloadNonce, onLoad, onActivate }: CanvasProps) {
	// Sayfa yüklenene kadar boş beyaz iframe yerine iskelet göster.
	const [loaded, setLoaded] = useState(false);
	useEffect(() => {
		setLoaded(false);
	}, [activeUrl, reloadNonce]);

	if (!tabs.length) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center p-8">
				<div className="max-w-sm text-center">
					<div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<Icon name="globe" className="size-5" />
					</div>
					<p className="text-sm font-medium text-foreground">{t("widget.previewUnavailable")}</p>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						{t("widget.previewUnavailableBody")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
			{tabs.map((tab) => {
				const active = tab.url === activeUrl;
				return (
					<div
						key={tab.url}
						className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background ${
							active ? "border-primary/40" : "border-border"
						}`}
					>
						<button
							type="button"
							onClick={() => onActivate(tab.url)}
							className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3 text-left"
							title={active ? t("widget.activePreview") : t("widget.makeActive")}
						>
							<span className="flex gap-1.5" aria-hidden="true">
								<span className="size-2 rounded-full bg-destructive/70" />
								<span className="size-2 rounded-full bg-amber-400/80" />
								<span className="size-2 rounded-full bg-emerald-500/80" />
							</span>
							<span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
								{tab.url}
							</span>
							{active ? (
								<span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
									{t("widget.live")}
								</span>
							) : null}
						</button>
						<div className="relative min-h-0 flex-1 bg-white">
							{active && !loaded ? (
								<div className="absolute inset-0 z-10 overflow-hidden bg-background p-5" aria-hidden="true">
									<div className="mx-auto flex h-full max-w-4xl flex-col gap-5">
										<div className="flex items-center justify-between gap-4">
											<Skeleton className="h-6 w-36" />
											<div className="hidden gap-2 sm:flex">
												<Skeleton className="h-5 w-14" />
												<Skeleton className="h-5 w-14" />
												<Skeleton className="h-5 w-14" />
											</div>
										</div>
										<div className="space-y-3">
											<Skeleton className="h-3 w-24" />
											<Skeleton className="h-10 w-3/4" />
											<Skeleton className="h-10 w-2/3" />
											<Skeleton className="h-3 w-full" />
											<Skeleton className="h-3 w-4/5" />
										</div>
										<div className="grid gap-3 sm:grid-cols-3">
											{[0, 1, 2].map((index) => (
												<div key={index} className="space-y-2 rounded-lg border border-border p-3">
													<Skeleton className="h-20 w-full rounded-md" />
													<Skeleton className="h-4 w-2/3" />
													<Skeleton className="h-3 w-full" />
												</div>
											))}
										</div>
									</div>
								</div>
							) : null}
							<iframe
								key={`${tab.url}:${active ? reloadNonce : 0}`}
								ref={active ? frameRef : undefined}
								src={withNonce(tab.url, active ? reloadNonce : 0)}
								title={tab.title}
								onLoad={active ? () => { setLoaded(true); onLoad(); } : undefined}
								className={`h-full w-full border-0 ${active ? "" : "pointer-events-none"}`}
								referrerPolicy="no-referrer"
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
