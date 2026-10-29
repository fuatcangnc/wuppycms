// Bejamas/ui Label — React portu (parite kaynağı: ui.bejamas.com/r/label).

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, children, ...props }: ComponentPropsWithoutRef<"label"> & { children: ReactNode }) {
	return (
		<label
			data-slot="label"
			className={cn(
				"gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
				className,
			)}
			{...props}
		>
			{children}
		</label>
	);
}
