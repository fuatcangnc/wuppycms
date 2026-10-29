// Bejamas/ui Dropdown Menu Trigger — React portu.
// Kurulu Astro tetikleyicisi Bejamas Button'ını kullanır; bu port da aynı
// Button'ı sarar ve açık durumu erişilebilir biçimde yayınlar.

import type { ComponentPropsWithoutRef, RefObject } from "react";
import { Button, type ButtonProps } from "@/components/ui-react/button";
import { cn } from "@/lib/utils";
import { useDropdownMenu } from "./DropdownMenu";

export function DropdownMenuTrigger({
	containerClassName,
	className,
	onClick,
	children,
	...props
}: ComponentPropsWithoutRef<"button"> & {
	variant?: ButtonProps["variant"];
	size?: ButtonProps["size"];
	containerClassName?: string;
}) {
	const { open, setOpen, triggerRef } = useDropdownMenu();

	return (
		<span
			ref={triggerRef as RefObject<HTMLSpanElement>}
			data-slot="dropdown-menu-trigger"
			className={cn("inline-flex", containerClassName)}
		>
			<Button
				{...props}
				as="button"
				type="button"
				data-slot="dropdown-menu-trigger"
				aria-haspopup="menu"
				aria-expanded={open}
				className={className}
				onClick={(event) => {
					onClick?.(event);
					setOpen(!open);
				}}
			>
				{children}
			</Button>
		</span>
	);
}
