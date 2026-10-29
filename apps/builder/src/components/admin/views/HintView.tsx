// Site seçildi, tarama/ilk veri sürüyor — pano iskeleti.

import { Skeleton, SkeletonRows } from "@/components/ui-react/skeleton";

export default function HintView() {
	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			<div className="mb-5 flex items-center gap-3">
				<Skeleton className="h-7 w-56" />
				<Skeleton className="ml-auto h-8 w-28" />
			</div>
			<Skeleton className="mb-2 h-3.5 w-24" />
			<div className="mb-6 grid gap-2 sm:grid-cols-2">
				{Array.from({ length: 4 }, (_, i) => (
					<Skeleton key={i} className="h-[76px]" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
				<div>
					<Skeleton className="mb-2 h-3.5 w-36" />
					<div className="rounded-xl border border-border">
						<SkeletonRows rows={4} />
					</div>
				</div>
				<div>
					<Skeleton className="mb-2 h-3.5 w-14" />
					<Skeleton className="h-28 rounded-xl" />
				</div>
			</div>
		</div>
	);
}
