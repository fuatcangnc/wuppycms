// CONTENT.md editörü — AI'a yazma rehberi.

import { useStore } from "@nanostores/react";
import { Button } from "@/components/ui-react/button";
import { Skeleton } from "@/components/ui-react/skeleton";
import { saveContentMd } from "@/lib/admin/actions";
import { $contentmd } from "@/lib/admin/store";

export default function ContentMdView() {
	const state = useStore($contentmd);
	return (
		<div className="mx-auto w-full max-w-3xl p-6">
			<div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></svg>
				<div className="text-sm">
					<p>
						<code className="rounded bg-muted px-1 font-mono text-xs">CONTENT.md</code> bu site için AI'a nasıl yazacağını anlatır.
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Ton, hedef kitle ve üslup kurallarını ekleyin. Gizli anahtar veya site ayarı yazmayın.
					</p>
				</div>
			</div>
			{state.loading ? (
				<div className="min-h-[55vh] space-y-2.5 rounded-lg border border-border p-3">
					{Array.from({ length: 10 }, (_, i) => (
						<Skeleton key={i} className={`h-3.5 ${i % 3 === 2 ? "w-2/3" : "w-11/12"}`} />
					))}
				</div>
			) : (
				<textarea
					spellCheck={false}
					placeholder={"# Site sesi\n\n- Hedef kitle: …\n- Ton: …\n- Yasak ifadeler: …"}
					value={state.text}
					onChange={(event) => $contentmd.set({ ...state, text: event.target.value })}
					className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[55vh] w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3"
				/>
			)}
			<div className="mt-3 flex justify-end">
				<Button size="sm" disabled={state.loading} onClick={() => void saveContentMd()}>
					CONTENT.md'yi {state.existed ? "kaydet" : "oluştur"}
				</Button>
			</div>
		</div>
	);
}
