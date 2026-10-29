// Bejamas/ui Alert — React portu (parite kaynağı: ui.bejamas.com/r/alert).

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
	"grid gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 gap-y-0.5 rounded-xl border-border bg-card has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current group/alert relative w-full",
	{
		variants: {
			variant: {
				default: "bg-card text-card-foreground",
				destructive:
					"text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export function Alert({
	variant,
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"div"> & VariantProps<typeof alertVariants> & { children: ReactNode }) {
	return (
		<div data-slot="alert" data-variant={variant} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
			{children}
		</div>
	);
}

export function AlertTitle({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn(
				"font-medium group-has-[>svg]/alert:col-start-2 col-start-2 line-clamp-1 min-h-4 tracking-tight cn-font-heading [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function AlertDescription({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 col-start-2 grid justify-items-start gap-1 [&_p]:leading-relaxed [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
