// Bejamas/ui Dropdown Menu Separator — React portu.

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			{...props}
			role="separator"
			data-slot="dropdown-menu-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
		/>
	);
}
