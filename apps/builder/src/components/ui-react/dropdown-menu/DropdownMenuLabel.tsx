// Bejamas/ui Dropdown Menu Label — React portu.

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DropdownMenuLabel({
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"div"> & { children?: ReactNode }) {
	return (
		<div
			{...props}
			data-slot="dropdown-menu-label"
			className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
		>
			{children}
		</div>
	);
}
