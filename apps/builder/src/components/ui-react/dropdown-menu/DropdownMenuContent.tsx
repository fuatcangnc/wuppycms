// Bejamas/ui Dropdown Menu Content — React portu.
// Registry sınıfları birebir taşınır; konum tetikleyicinin altına hesaplanır.
// Portal, widget'ın z-index'inin üstünde kalır; açık menü dışına tıklama ve
// Escape ile kapanır.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useDropdownMenu } from "./DropdownMenu";

const CONTENT_CLASS = cn(
	"z-[100] max-h-[min(20rem,calc(100vh-1rem))] min-w-32 overflow-x-hidden overflow-y-auto overscroll-none rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
	"data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
);

export function DropdownMenuContent({
	align = "start",
	sideOffset = 4,
	className,
	children,
}: {
	align?: "start" | "center" | "end";
	sideOffset?: number;
	className?: string;
	children: ReactNode;
}) {
	const { open, setOpen, triggerRef } = useDropdownMenu();
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<{
		top: number;
		left?: number;
		right?: number;
		transform?: string;
	} | null>(null);

	useLayoutEffect(() => {
		if (!open) return;
		const update = () => {
			const trigger = triggerRef.current;
			if (!trigger) return;
			const rect = trigger.getBoundingClientRect();
			const top = rect.bottom + sideOffset;
			if (align === "end") {
				setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) });
			} else if (align === "center") {
				setPosition({
					top,
					left: rect.left + rect.width / 2,
					transform: "translateX(-50%)",
				});
			} else {
				setPosition({ top, left: Math.max(8, rect.left) });
			}
		};

		update();
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);
		return () => {
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [open, align, sideOffset, triggerRef]);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (contentRef.current?.contains(target)) return;
			if (triggerRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open, setOpen, triggerRef]);

	if (!open) return null;

	return createPortal(
		<div
			ref={contentRef}
			role="menu"
			data-slot="dropdown-menu-content"
			data-state="open"
			data-open=""
			data-side="bottom"
			data-align={align}
			style={{
				position: "fixed",
				top: position?.top ?? 0,
				left: position?.left,
				right: position?.right,
				transform: position?.transform,
				visibility: position ? "visible" : "hidden",
			}}
			className={cn(CONTENT_CLASS, className)}
		>
			{children}
		</div>,
		document.body,
	);
}
