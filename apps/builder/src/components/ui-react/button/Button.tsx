// Bejamas/ui Button — React portu.
// Bejamas registry'si şu an yalnız .astro dağıtıyor; bu dosya, CLI ile kurulu
// src/components/ui/button/Button.astro bileşeninin sınıf/cva paritesini React
// tarafına taşır (üçüncü bir kütüphaneden BESLEMEZ). Kurulu bileşen değişirse
// buradaki sınıf sabitleri de güncellenir.

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          // Kumo tarzı vurgu: marka degrade + üst iç parlama + koyu ring.
          // Renk katmanı değişkenler global.css'te (--button-primary-*).
          "relative overflow-hidden border-0 text-white bg-linear-to-b from-(--button-primary-grad-top) to-(--button-primary-grad-bottom) hover:from-(--button-primary-grad-top-hover) shadow-[0_1px_2px_rgb(0_0_0/6%),inset_0_1px_0_0_var(--button-primary-gloss)] ring-1 ring-(--button-primary-ring) focus-visible:ring-(--button-primary-ring) active:ring-(--button-primary-ring)",
        destructive:
          // Sil gibi kalıcı işlemler — primary ile aynı Kumo mekaniği, kırmızı.
          "relative overflow-hidden border-0 text-white bg-linear-to-b from-(--button-danger-grad-top) to-(--button-danger-grad-bottom) hover:from-(--button-danger-grad-top-hover) shadow-[0_1px_2px_rgb(0_0_0/6%),inset_0_1px_0_0_var(--button-danger-gloss)] ring-1 ring-(--button-danger-ring) focus-visible:ring-(--button-danger-ring) active:ring-(--button-danger-ring)",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground shadow-xs border shadow-none",
        // Kullanıcı kararı: secondary her zaman outline kenarlıklı (Vazgeç/
        // Kapat ikincil eylemler); registry'nin düz dolgu ikili görünümünden
        // ayrılır.
        secondary: "border-input bg-transparent text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-secondary-foreground border shadow-none",
        ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground hover:bg-secondary shadow-none",
        link: "text-primary underline-offset-4 hover:underline text-accent p-0",
      },
      size: {
        default: "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 gap-2 px-3 py-2 text-sm has-[.badge:last-child]:pr-1.5 has-[>svg]:px-2.5",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 gap-1.5 rounded-lg px-3 text-xs has-[>svg]:px-2",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 rounded-lg px-5 text-base has-[>svg]:px-4 has-[.badge:last-child]:pr-3 [&_.badge:last-child]:ml-1.5",
        icon: "size-9",
        "icon-sm": "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  children?: ReactNode;
};

export type ButtonProps = ButtonBaseProps &
  (
    | ({ as?: "button" } & ComponentPropsWithoutRef<"button">)
    | ({ as: "a" } & ComponentPropsWithoutRef<"a">)
  );

export function Button(props: ButtonProps) {
  const { as: Tag = "button", variant, size, className, children, ...rest } = props as ButtonBaseProps & Record<string, unknown> & { as?: "button" | "a" };
  return (
    <Tag
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-md border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 ease-out duration-150 rounded-lg active:scale-98",
        buttonVariants({ variant, size }),
        className,
      )}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}
