// Bejamas/ui Avatar — React portu (parite kaynağı: ui.bejamas.com/r/avatar).
// AvatarGroup/Badge alt parçaları ihtiyaç doğunca aynı kaynaktan eklenir.

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Avatar({
	size = "default",
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"span"> & { size?: "default" | "sm" | "lg"; children: ReactNode }) {
	return (
		<span
			data-slot="avatar"
			data-size={size}
			className={cn(
				"size-8 rounded-full after:rounded-full data-[size=lg]:size-10 data-[size=sm]:size-6",
				"group/avatar relative flex shrink-0 select-none",
				"after:absolute after:inset-0",
				"z-1",
				className,
			)}
			{...props}
		>
			{children}
		</span>
	);
}

export function AvatarImage({ className, ...props }: ComponentPropsWithoutRef<"img">) {
	return (
		<img
			data-slot="avatar-image"
			className={cn("rounded-full", "relative z-10 aspect-square size-full object-cover", className)}
			{...props}
		/>
	);
}

export function AvatarFallback({ className, children, ...props }: ComponentPropsWithoutRef<"div"> & { children: ReactNode }) {
	return (
		<div
			data-slot="avatar-fallback"
			className={cn(
				"bg-muted text-muted-foreground rounded-full",
				"absolute inset-0 flex size-full items-center justify-center",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
