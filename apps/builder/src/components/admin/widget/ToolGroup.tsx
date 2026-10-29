/** Katlanmış araç çağrısı grubu: tek satır özet, açılınca çağrılar. */

import { useEffect, useRef } from "react";
import { Icon } from "@/components/admin/parts";
import { summarizeTools, toolArgsPreview, toolGroupLabel } from "./lib/tool-summary";
import type { ToolChip } from "./types";

export function ToolGroup({ chips }: { chips: ToolChip[] }) {
	const ref = useRef<HTMLDetailsElement | null>(null);
	const counts = summarizeTools(chips);
	const failed = counts.failed > 0;
	const running = counts.running > 0;

	useEffect(() => {
		// Koşu bitince çağrı grubunu kapat; kullanıcı isterse yeniden açar.
		if (!running && ref.current && !failed) ref.current.open = false;
	}, [running, failed]);

	if (!chips.length) return null;
	return (
		<details ref={ref} open={failed || undefined} className="group my-2 rounded-lg border border-border bg-muted/20">
			<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
				<Icon
					name={running ? "terminal" : failed ? "x" : "check"}
					className={`size-3.5 ${failed ? "text-destructive" : running ? "text-primary" : "text-emerald-500"}`}
				/>
				<span className="min-w-0 flex-1 truncate" aria-live={running ? "polite" : undefined}>
					{toolGroupLabel(counts)}
				</span>
				<Icon name="chevron-right" className="size-3 transition-transform group-open:rotate-90" />
			</summary>
			<ul className="space-y-1 border-t border-border px-2 py-2">
				{chips.map((chip) => {
					const preview = toolArgsPreview(chip.args);
					return (
						<li key={chip.callId}>
							<details className="group/tool rounded-md">
								<summary className="flex cursor-pointer list-none items-center gap-2 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/50">
									<Icon
										name={chip.running ? "terminal" : chip.ok === false ? "x" : "check"}
										className={`size-3 ${chip.ok === false ? "text-destructive" : ""}`}
									/>
									<span className="font-mono text-foreground/80">{chip.name}</span>
									{preview ? <span className="min-w-0 flex-1 truncate opacity-70">{preview}</span> : null}
								</summary>
								<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[10.5px] text-muted-foreground">
									{chip.args === undefined || chip.args === null
										? ""
										: JSON.stringify(chip.args, null, 1)}
									{chip.summary ? `${chip.args == null ? "" : "\n→ "}${chip.summary}` : ""}
								</pre>
							</details>
						</li>
					);
				})}
			</ul>
		</details>
	);
}
