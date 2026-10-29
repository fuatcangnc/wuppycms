// URL → mağaza projeksiyonu — react-router konumu her değiştiğinde (ilk
// açılış, popstate, kendi push'larımız) adresi okuyup görünüm durumunu
// eşitler; router.tsx'teki applyRoute idempotenttir, push'larda çoğunlukla
// no-op kalır ve kanonik olmayan adresi replace ile düzeltir.

import { useStore } from "@nanostores/react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyRoute } from "@/lib/admin/router";
import { $booted, $sites } from "@/lib/admin/store";

export default function RouteApplier() {
	const booted = useStore($booted);
	const sites = useStore($sites);
	const location = useLocation();

	useEffect(() => {
		if (!booted) return;
		// Legacy `/admin/c/...` adreslerinde site slug'ı yoktur; siteler
		// yüklendikten sonra tekrar uygula (aksi hâlde genel bakışa düşer).
		void applyRoute(new URL(location.pathname + location.search, window.location.origin));
	}, [booted, location.key, sites.length]);

	return null;
}
