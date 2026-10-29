// Bejamas/ui Tabs — React portu (parite kaynağı: ui.bejamas.com/r/tabs).
// Astro sürümü davranışı @data-slot/tabs betiğinden alır; React portunda
// durum kontrollüdür (value + onValueChange), sınıflar registry ile birebir.

import { createContext, useContext, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

type TabsContextValue = { value: string; select: (value: string) => void };
const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
	value,
	onValueChange,
	orientation = "horizontal",
	className,
	children,
}: {
	value: string;
	onValueChange: (value: string) => void;
	orientation?: "horizontal" | "vertical";
	className?: string;
	children: ReactNode;
}) {
	return (
		<TabsContext.Provider value={{ value, select: onValueChange }}>
			<div
				data-slot="tabs"
				data-orientation={orientation}
				data-horizontal={orientation === "horizontal" ? "true" : undefined}
				data-vertical={orientation === "vertical" ? "true" : undefined}
				data-default-value={value}
				className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
			>
				{children}
			</div>
		</TabsContext.Provider>
	);
}

const tabsListVariants = cva(
	"group/tabs-list text-muted-foreground relative inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
	{
		variants: {
			variant: {
				indicator: "rounded-lg bg-muted p-[2px]",
				default: "rounded-lg bg-muted p-[3px]",
				line: "rounded-none gap-1 bg-transparent p-0",
				"line-animated": "rounded-none gap-1 bg-transparent p-0",
			},
			size: {
				default: "group-data-horizontal/tabs:h-9",
				sm: "group-data-horizontal/tabs:h-8",
				lg: "group-data-horizontal/tabs:h-10",
			},
		},
		defaultVariants: { variant: "indicator", size: "default" },
	},
);

export function TabsList({
	variant = "indicator",
	size = "default",
	className,
	children,
}: {
	variant?: "indicator" | "default" | "line" | "line-animated";
	size?: "default" | "sm" | "lg";
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			data-slot="tabs-list"
			data-variant={variant}
			data-size={size}
			className={cn(tabsListVariants({ variant, size }), className)}
		>
			{children}
		</div>
	);
}

export function TabsTrigger({
	value,
	disabled,
	className,
	children,
}: {
	value: string;
	disabled?: boolean;
	className?: string;
	children: ReactNode;
}) {
	const ctx = useContext(TabsContext);
	const active = ctx?.value === value;
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			disabled={disabled}
			data-slot="tabs-trigger"
			data-value={value}
			data-state={active ? "active" : "inactive"}
			onClick={() => ctx?.select(value)}
			className={cn(
				"gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4",
				"relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap outline-none transition-all disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
				"focus-visible:border-ring focus-visible:ring-ring/50 text-foreground/60 hover:text-foreground data-[state=active]:text-foreground focus-visible:ring-[3px] focus-visible:outline-1 focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground",
				"group-data-[variant=default]/tabs-list:data-[state=active]:bg-background dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
				"group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm",
				"group-data-[variant=indicator]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=indicator]/tabs-list:data-[state=active]:shadow-none",
				"group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
				"group-data-[variant=line-animated]/tabs-list:rounded-none group-data-[variant=line-animated]/tabs-list:bg-transparent group-data-[variant=line-animated]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line-animated]/tabs-list:data-[state=active]:shadow-none",
				"after:pointer-events-none after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=default]/tabs-list:after:hidden group-data-[variant=indicator]/tabs-list:after:hidden group-data-[variant=line-animated]/tabs-list:after:hidden group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
				className,
			)}
		>
			{children}
		</button>
	);
}

/** Registry'deki animation="none" varsayımı: gizle/göster yerine mount etme. */
export function TabsContent({
	value,
	className,
	children,
}: {
	value: string;
	className?: string;
	children: ReactNode;
}) {
	const ctx = useContext(TabsContext);
	if (ctx?.value !== value) return null;
	return (
		<div role="tabpanel" data-slot="tabs-content" data-value={value} tabIndex={0} className={cn("text-sm", className)}>
			{children}
		</div>
	);
}
