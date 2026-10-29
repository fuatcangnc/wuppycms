// Bejamas/ui Skeleton — React portu (parite kaynağı: components/ui/skeleton/Skeleton.astro).
// Tüm yükleme iskeletleri bunu kullanır; ek olarak satır/kart listeleri için
// SkeletonRows ve SkeletonGrid yardımcıları burada.

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
	return <div data-slot="skeleton" className={cn("bg-muted animate-pulse rounded-md", className)} {...props} />;
}

/** Tablo/liste yüklemeleri: her satır = bir satır yüksekliğinde iki şerit. */
export function SkeletonRows({
	rows = 4,
	className,
}: {
	rows?: number;
	className?: string;
}) {
	return (
		<div className={className}>
			{Array.from({ length: rows }, (_, i) => (
				<div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0">
					<Skeleton className="h-4 w-2/5" />
					<Skeleton className="h-3 w-1/3" />
					<Skeleton className="ml-auto size-6 rounded-full" />
				</div>
			))}
		</div>
	);
}

/** Kart ızgarası yüklemeleri (medya, koleksiyonlar, depo listesi). */
export function SkeletonGrid({
	count = 8,
	className,
	thumbClassName = "h-24",
}: {
	count?: number;
	className?: string;
	thumbClassName?: string;
}) {
	return (
		<div className={className}>
			{Array.from({ length: count }, (_, i) => (
				<div key={i} className="overflow-hidden rounded-xl border border-border">
					<Skeleton className={`w-full rounded-none ${thumbClassName}`} />
					<div className="space-y-1.5 p-2">
						<Skeleton className="h-3 w-3/4" />
						<Skeleton className="h-2.5 w-1/3" />
					</div>
				</div>
			))}
		</div>
	);
}
