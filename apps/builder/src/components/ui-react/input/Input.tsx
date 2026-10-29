// Bejamas/ui Input — React portu (parite kaynağı: components/ui/input/Input.astro).

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type InputProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  /** Bejamas boyutu (sm|default|lg) — native `size` yerine data-size. */
  size?: "sm" | "default" | "lg";
};

export function Input({ size = "default", className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-md border bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] file:h-7 file:text-sm file:font-medium focus-visible:ring-3 md:text-sm rounded-lg data-[size=sm]:h-8 data-[size=sm]:px-2.5 data-[size=sm]:py-1 data-[size=sm]:md:text-xs data-[size=default]:h-9 data-[size=default]:px-3 data-[size=default]:py-1 data-[size=default]:md:text-sm data-[size=lg]:h-10 data-[size=lg]:px-3.5 data-[size=lg]:py-1.5 data-[size=lg]:md:text-base w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
