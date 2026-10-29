// Hata bandı — $error dolu olduğu sürede görünür (Bejamas Alert, destructive).

import { useStore } from "@nanostores/react";
import { $error } from "@/lib/admin/store";
import { Alert, AlertDescription } from "@/components/ui-react/alert";

export default function ErrorBanner() {
	const message = useStore($error);
	if (!message) return null;
	return (
		<Alert variant="destructive" className="shrink-0 rounded-none border-x-0 border-t-0 border-destructive/40 py-2">
			<AlertDescription className="col-start-1 text-destructive/90">{message}</AlertDescription>
		</Alert>
	);
}
