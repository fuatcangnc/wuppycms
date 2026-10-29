// Bejamas/ui Table — React portu (parite kaynağı: ui.bejamas.com/r/table).

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, children, ...props }: ComponentPropsWithoutRef<"table"> & { children?: ReactNode }) {
	return (
		<div data-slot="table-container" className="relative w-full overflow-x-auto">
			<table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props}>
				{children}
			</table>
		</div>
	);
}

export function TableHeader({ className, children, ...props }: ComponentPropsWithoutRef<"thead"> & { children?: ReactNode }) {
	return (
		<thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props}>
			{children}
		</thead>
	);
}

export function TableBody({ className, children, ...props }: ComponentPropsWithoutRef<"tbody"> & { children?: ReactNode }) {
	return (
		<tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props}>
			{children}
		</tbody>
	);
}

export function TableRow({ className, children, ...props }: ComponentPropsWithoutRef<"tr"> & { children?: ReactNode }) {
	return (
		<tr data-slot="table-row" className={cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", className)} {...props}>
			{children}
		</tr>
	);
}

export function TableHead({ className, children, ...props }: ComponentPropsWithoutRef<"th"> & { children?: ReactNode }) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
				className,
			)}
			{...props}
		>
			{children}
		</th>
	);
}

export function TableCell({ className, children, ...props }: ComponentPropsWithoutRef<"td"> & { children?: ReactNode }) {
	return (
		<td
			data-slot="table-cell"
			className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
			{...props}
		>
			{children}
		</td>
	);
}
