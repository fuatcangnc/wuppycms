// Diyalog kabuğu — Bejamas Dialog portu (ui-react/dialog) üzerinde ince katman.
// Hangi diyaloğun açık olduğuna $dialogs karar verir; bu yüzden port "açıkken
// mount" edilir. Dışa tıklama overlay'i kapatır, Escape'i Dialog yönetir.

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui-react/dialog";

export function DialogShell({
	children,
	panelClassName,
	onClose,
}: {
	children: ReactNode;
	panelClassName: string;
	onClose: () => void;
}) {
	return (
		<Dialog open onClose={onClose}>
			<DialogOverlay onPointerDown={onClose} />
			<DialogContent className={panelClassName}>{children}</DialogContent>
		</Dialog>
	);
}
