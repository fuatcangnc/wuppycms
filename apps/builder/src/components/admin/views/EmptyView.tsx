// Boş durum: hiç site eklenmemiş.

import { Button } from "@/components/ui-react/button";
import { openDialog } from "@/lib/admin/store";

export default function EmptyView() {
	return (
		<div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
			<span className="flex size-14 items-center justify-center rounded-full border border-border bg-muted/40">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-6 text-muted-foreground" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
			</span>
			<h1 className="text-lg font-semibold">İlk siteni ekle</h1>
			<p className="max-w-sm text-sm text-muted-foreground">
				Web sitenizin arkasındaki GitHub deposunu seçin; WuppyCMS içeriği repodan okur,
				her kayıt gerçek bir commit olur.
			</p>
			<div className="mt-2 flex items-center gap-2">
				<Button onClick={() => openDialog("site")}>+ Site ekle</Button>
				<Button variant="outline" size="sm" as="a" href="/projects">Projeler</Button>
			</div>
			<p className="mt-4 max-w-sm text-xs text-muted-foreground">
				Sağda duran sözümüz: deponuz tek doğruluk kaynağıdır. WuppyCMS repoyu doğrudan
				okur-yazar; senkron tutulacak içerik kopyası yoktur.
			</p>
		</div>
	);
}
