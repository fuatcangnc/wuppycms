/** Kalıcı sohbet geçmişi rayı. */

import type { SessionSummary } from "@/lib/agent/protocol";
import { Icon } from "@/components/admin/parts";
import { t } from "@/lib/i18n";

export function ChatHistory({
	sessions,
	activeId,
	loading = false,
	onSelect,
	onNew,
}: {
	sessions: SessionSummary[];
	activeId: string | null;
	loading?: boolean;
	onSelect(id: string): void;
	onNew(): void;
}) {
	return (
		<nav
			className="flex w-44 shrink-0 flex-col border-r border-border"
			aria-label={t("widget.history")}
		>
			<div className="border-b border-border p-2">
				<button
					type="button"
					onClick={onNew}
					className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
				>
					<Icon name="plus" className="size-4" />
					{t("widget.newChat")}
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-1.5">
				{loading && sessions.length === 0 ? (
					<div className="space-y-1.5 p-0.5" aria-label={t("widget.history")}>
						{[0, 1, 2].map((index) => (
							<div key={index} className="animate-pulse rounded-lg bg-accent/60 px-2.5 py-2">
								<div className="h-2.5 w-3/4 rounded bg-foreground/10" />
								<div className="mt-1.5 h-2 w-1/3 rounded bg-foreground/10" />
							</div>
						))}
					</div>
				) : sessions.length === 0 ? (
					<p className="px-2 py-4 text-[11px] text-muted-foreground">{t("widget.noHistory")}</p>
				) : (
					<ul className="space-y-0.5">
						{sessions.map((session) => {
							const active = session.id === activeId;
							return (
								<li key={session.id}>
									<button
										type="button"
										aria-current={active ? "true" : undefined}
										title={session.title}
										onClick={() => onSelect(session.id)}
										className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
											active ? "bg-accent text-foreground" : "text-foreground/75 hover:bg-accent/60"
										}`}
									>
										<span className="block truncate text-xs font-medium">{session.title}</span>
										<span className="mt-0.5 block text-[10.5px] text-muted-foreground">
											{t("widget.messageCount", { count: session.messageCount })}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</nav>
	);
}
