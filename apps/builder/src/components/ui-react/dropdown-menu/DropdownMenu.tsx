// Bejamas/ui Dropdown Menu — React portu.
// Kaynak: ui.bejamas.com/r/dropdown-menu.json, kurulu Astro karşılığı
// components/ui/dropdown-menu/. Registry yalnız .astro dağıtıyor; açık durum,
// konumlandırma, dışa tıklama ve Escape davranışı React tarafında kontrollü
// state ile kurulur. Üçüncü bir UI kütüphanesinden beslenmez.

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from "react";
import { cn } from "@/lib/utils";

type DropdownContextValue = {
	open: boolean;
	setOpen(next: boolean): void;
	triggerRef: RefObject<HTMLElement | null>;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

export function useDropdownMenu(): DropdownContextValue {
	const context = useContext(DropdownContext);
	if (!context) throw new Error("DropdownMenu bileşenleri DropdownMenu içinde kullanılmalı.");
	return context;
}

export function DropdownMenu({
	open: controlledOpen,
	defaultOpen = false,
	onOpenChange,
	className,
	children,
}: {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?(open: boolean): void;
	className?: string;
	children: ReactNode;
}) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const open = controlledOpen ?? uncontrolledOpen;
	const triggerRef = useRef<HTMLElement | null>(null);

	const setOpen = useCallback(
		(next: boolean) => {
			if (controlledOpen === undefined) setUncontrolledOpen(next);
			onOpenChange?.(next);
		},
		[controlledOpen, onOpenChange],
	);

	const value = useMemo(
		() => ({ open, setOpen, triggerRef }),
		[open, setOpen],
	);

	return (
		<DropdownContext.Provider value={value}>
			<div data-slot="dropdown-menu" data-state={open ? "open" : "closed"} className={cn("relative inline-block", className)}>
				{children}
			</div>
		</DropdownContext.Provider>
	);
}
