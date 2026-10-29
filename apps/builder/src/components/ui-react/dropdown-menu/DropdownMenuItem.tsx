// Bejamas/ui Dropdown Menu Item — React portu (sınıf paritesi:
// components/ui/dropdown-menu/DropdownMenuItem.astro).

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useDropdownMenu } from "./DropdownMenu";

const ITEM_CLASS = cn(
	"group/dropdown-menu-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
	"data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive",
	"focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
	"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

export function DropdownMenuItem({
	onSelect,
	disabled = false,
	className,
	children,
	...props
}: Omit<ComponentPropsWithoutRef<"div">, "onSelect"> & {
	onSelect?(): void;
	disabled?: boolean;
	children?: ReactNode;
}) {
	const { setOpen } = useDropdownMenu();

	const select = () => {
		if (disabled) return;
		onSelect?.();
		setOpen(false);
	};

	return (
		<div
			{...props}
			role="menuitem"
			tabIndex={disabled ? -1 : 0}
			data-slot="dropdown-menu-item"
			data-disabled={disabled ? "" : undefined}
			aria-disabled={disabled || undefined}
			className={cn(ITEM_CLASS, className)}
			onClick={(event) => {
				props.onClick?.(event);
				select();
			}}
			onKeyDown={(event) => {
				props.onKeyDown?.(event);
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					select();
				}
			}}
		>
			{children}
		</div>
	);
}
