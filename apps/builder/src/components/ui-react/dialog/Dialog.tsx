// Bejamas/ui Dialog — React portu (parite kaynağı: ui.bejamas.com/r/dialog.json,
// kurulu Astro karşılığı components/ui/dialog/). Sınıflar ve data-open niteliği
// birebir aynıdır; .astro sürümündeki @data-slot/dialog durum motorunun yerini
// React tarafında kontrollü açık durum alır: portal (body), açık diyaloğun
// role="dialog" + aria-modal olması, yığın sırasıyla Escape (üst diyalog
// yanıt verir), odak tuzağı + geri yükleme, arka planın inert edilmesi,
// dışa tıklamayla kapanma (registry varsayılanı closeOnClickOutside=true) ve
// kaydırma kilidi. Üçüncü bir kütüphaneden beslemez.

import {
	createContext,
	useContext,
	useEffect,
	useId,
	useState,
	type ComponentPropsWithoutRef,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DivProps = ComponentPropsWithoutRef<"div">;

/** data-open: varyantları bejamas/tailwind.css'te [data-open] niteliğine bağlı. */
function openAttrs(open: boolean) {
	return open ? { "data-open": "" } : { "data-closed": "" };
}

/** Açık diyalog yığını: Escape'i yalnız en üstteki diyalog işler. */
const stack: number[] = [];
let tokenSeq = 0;

type DialogApi = { onClose: () => void; titleId: string };
const DialogCtx = createContext<DialogApi | null>(null);

export function Dialog({
	open,
	onClose,
	className,
	closeOnEscape = true,
	lockScroll = true,
	children,
	...rest
}: Omit<DivProps, "children"> & {
	open: boolean;
	onClose: () => void;
	closeOnEscape?: boolean;
	lockScroll?: boolean;
	children?: ReactNode;
}) {
	const titleId = useId();
	// Portal konağı: diyalog gövdesi body'nin sonuna taşınır — uygulama
	// ağacındaki transform/overflow bağlarından bağımsızlaşır, arka plan
	// inert edilebilir olur.
	const [host] = useState<HTMLDivElement | null>(() =>
		typeof document === "undefined" ? null : document.createElement("div"),
	);

	useEffect(() => {
		if (!open || !host) return;
		document.body.appendChild(host);
		const token = ++tokenSeq;
		stack.push(token);

		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !closeOnEscape) return;
			// Yalnız en üstteki diyalog kapanır (lightbox → diyalog sırası).
			if (stack[stack.length - 1] !== token) return;
			onClose();
		};
		document.addEventListener("keydown", onKey);

		// Arka plan etkileşime kapalı: konağın dışındaki her şey inert.
		// Zaten inert olanı sahiplenmeyiz — kapanışta onu biz kaldırmayız.
		const inerted: HTMLElement[] = [];
		for (const el of Array.from(document.body.children) as HTMLElement[]) {
			if (el === host || el.hasAttribute("inert")) continue;
			el.setAttribute("inert", "");
			inerted.push(el);
		}

		let previousOverflow: string | null = null;
		if (lockScroll) {
			previousOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
		}

		// Odak: konak artık body'de — içeriğe ilk odaklanabilir öğeyle gir,
		// Tab'ı içeride tut, kapanışta tetikleyiciye dön.
		const content = host.querySelector<HTMLElement>('[data-slot="dialog-content"]');
		const previously = document.activeElement as HTMLElement | null;
		const focusables = () =>
			content
				? [
						...content.querySelectorAll<HTMLElement>(
							'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
						),
					].filter((node) => node.offsetParent !== null || node === document.activeElement)
				: [];
		if (content) {
			(content.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? content).focus();
		}
		const onTab = (event: KeyboardEvent) => {
			if (event.key !== "Tab" || !content) return;
			const items = focusables();
			if (items.length === 0) {
				event.preventDefault();
				content.focus();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === content)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};
		content?.addEventListener("keydown", onTab);

		return () => {
			document.removeEventListener("keydown", onKey);
			content?.removeEventListener("keydown", onTab);
			const at = stack.indexOf(token);
			if (at >= 0) stack.splice(at, 1);
			inerted.forEach((el) => el.removeAttribute("inert"));
			if (previousOverflow !== null) document.body.style.overflow = previousOverflow;
			if (previously && document.contains(previously) && !host.contains(previously)) {
				previously.focus();
			}
			host.remove();
		};
	}, [open, onClose, closeOnEscape, lockScroll, host]);

	if (!open || !host) return null;
	return createPortal(
		<DialogCtx.Provider value={{ onClose, titleId }}>
			<div data-slot="dialog" {...openAttrs(open)} className={cn("", className)} {...rest}>
				{children}
			</div>
		</DialogCtx.Provider>,
		host,
	);
}

export function DialogOverlay({ className, onPointerDown, ...rest }: DivProps) {
	const ctx = useContext(DialogCtx);
	return (
		<div
			data-slot="dialog-overlay"
			className={cn(
				"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50",
				className,
			)}
			// Registry varsayılanı: dışa tıklama kapatır (closeOnClickOutside).
			onPointerDown={onPointerDown ?? (ctx ? ctx.onClose : undefined)}
			{...rest}
		/>
	);
}

export function DialogClose({
	children,
	className,
	...rest
}: ComponentPropsWithoutRef<"button">) {
	const ctx = useContext(DialogCtx);
	return (
		<button
			type="button"
			data-slot="dialog-close"
			data-dialog-close
			onClick={rest.onClick ?? ctx?.onClose}
			className={cn("absolute top-4 right-4 inline-flex items-center gap-2", className)}
			{...rest}
		>
			{children ?? (
				<>
					<svg
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="size-4"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
					<span className="sr-only">Close</span>
				</>
			)}
		</button>
	);
}

export function DialogContent({
	children,
	className,
	showCloseButton = true,
	...rest
}: Omit<DivProps, "children"> & { showCloseButton?: boolean; children?: ReactNode }) {
	const ctx = useContext(DialogCtx);
	// Başlık yoksa (veya çağıran aria-label veriyorsa) kopuk aria-labelledby bırakma.
	const labelBy = rest["aria-label"] ? undefined : ctx?.titleId;
	return (
		<div data-slot="dialog-portal" className="z-50 isolate absolute">
			<div
				data-slot="dialog-content"
				data-open=""
				role="dialog"
				aria-modal="true"
				aria-labelledby={labelBy}
				tabIndex={-1}
				className={cn(
					"bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-6 rounded-xl p-6 text-sm ring-1 duration-100 sm:max-w-md fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none",
					className,
				)}
				{...rest}
			>
				{children}
				{showCloseButton && <DialogClose />}
			</div>
		</div>
	);
}

export function DialogHeader({ className, ...rest }: DivProps) {
	return <div data-slot="dialog-header" className={cn("gap-2 flex flex-col", className)} {...rest} />;
}

export function DialogTitle({ className, ...rest }: DivProps) {
	const ctx = useContext(DialogCtx);
	return (
		<div
			data-slot="dialog-title"
			id={ctx?.titleId}
			className={cn("leading-none font-medium cn-font-heading", className)}
			{...rest}
		/>
	);
}

export function DialogDescription({ className, ...rest }: DivProps) {
	return (
		<div
			data-slot="dialog-description"
			className={cn(
				"text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
				className,
			)}
			{...rest}
		/>
	);
}

export function DialogFooter({ className, ...rest }: DivProps) {
	return <div data-slot="dialog-footer" className={cn("flex justify-end gap-2", className)} {...rest} />;
}
