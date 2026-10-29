// Bejamas/ui Badge — React portu (parite kaynağı: ui.bejamas.com/r/badge).

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	["inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap overflow-hidden transition-[color,box-shadow]", "gap-1 [&>svg]:pointer-events-none"],
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
				secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
				destructive:
					"bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20",
				outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
			},
			shape: { default: "rounded-xs", pill: "rounded-full" },
			size: { default: "text-sm h-6", sm: "text-xs h-5" },
		},
		defaultVariants: { variant: "default", shape: "default", size: "default" },
	},
);

export function Badge({
	variant,
	shape,
	size,
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"span"> &
	VariantProps<typeof badgeVariants> & { as?: "span" | "div"; children?: ReactNode }) {
	return (
		<span
			data-slot="badge"
			data-variant={variant}
			data-size={size}
			className={cn(
				"h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! rounded-full",
				badgeVariants({ variant, shape, size }),
				className,
			)}
			{...props}
		>
			{children}
		</span>
	);
}
