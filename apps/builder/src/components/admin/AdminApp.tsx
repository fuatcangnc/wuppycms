// Admin React adacığının girişi — sağlayıcılar (TanStack Query + react-router)
// ve yönlendirilmiş kabuk. Router örneği tembel yaratılır (workerd SSR'ın
// document'i yok; adacık yalnız istemcide render alır). Asıl arayüz AdminShell.

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router-dom";
import { seedBoot, type BootPayload } from "@/lib/admin/boot";
import { queryClient } from "@/lib/admin/queryClient";
import { getAdminRouter } from "@/lib/admin/router";

export default function AdminApp({ boot }: { boot?: BootPayload }) {
	// client:only olsa da dev SSR'ı render denemesi yapabiliyor (workerd'de
	// document yok → createBrowserHistory çöker); istemci sınırı burada.
	// SSR tohumu router kurulmadan ÖNCE kuşanılır (ilk render iskeletsiz).
	const [router] = useState(() => {
		if (typeof document === "undefined") return null;
		if (boot) seedBoot(boot);
		return getAdminRouter();
	});
	if (!router) return null;
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
