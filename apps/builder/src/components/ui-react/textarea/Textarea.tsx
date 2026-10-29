// Bejamas/ui Textarea — React portu (parite kaynağı: ui.bejamas.com/r/textarea).
// Widget composer'ı odak yönetimi için ref geçirir; port forwardRef ile aynı
// sınıf paritesini korur.

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(
	function Textarea({ className, ...props }, ref) {
		return (
			<textarea
				ref={ref}
				data-slot="textarea"
				className={cn(
					"border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-md border bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] focus-visible:ring-3 md:text-sm px-3 flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		);
	},
);
