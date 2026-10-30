// Yayın hedefi seçimi ve "Deploy" düğmesi (ADR 0022).
//
// İki hedef:
//  • WuppyCMS altyapısı (AWS)   — varsayılan, müşteri hiçbir şey kurmaz
//  • Kendi Cloudflare hesabım   — OAuth ile bağlanır, domain ayarları müşteride

import { useEffect, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui-react/dropdown-menu";
import { t } from "@/lib/i18n";

type Targets = {
	aws: { available: boolean; default: boolean };
	cloudflare: {
		available: boolean;
		connected: boolean;
		accountName: string | null;
		accountId: string | null;
	};
};

export function DeployButton({
	repoFullName,
	onDone,
}: {
	repoFullName: string;
	onDone?(message: { kind: "ok" | "error"; text: string }): void;
}) {
	const [targets, setTargets] = useState<Targets | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void (async () => {
			try {
				const res = await fetch("/api/deploy/targets", { credentials: "same-origin" });
				if (res.ok) setTargets((await res.json()) as Targets);
			} catch {
				// hedef bilgisi alınamazsa AWS varsayılanıyla devam
			}
		})();
	}, []);

	const deploy = (target: "aws" | "cloudflare") => {
		if (busy) return;
		if (target === "cloudflare" && !targets?.cloudflare.connected) {
			// OAuth akışına yönlendir; dönüşte /projects'e gelir.
			window.location.assign("/api/deploy/cloudflare/connect");
			return;
		}
		setBusy(true);
		void (async () => {
			try {
				const res = await fetch("/api/deploy/sync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ full_name: repoFullName, target }),
				});
				const data = (await res.json().catch(() => ({}))) as {
					results?: Array<{
						ok: boolean;
						status?: string;
						previewUrl?: string;
						error?: string;
					}>;
					message?: string;
				};
				const result = data.results?.[0];
				if (!res.ok || !result?.ok) {
					throw new Error(result?.error ?? data.message ?? t("project.deployFailed"));
				}
				onDone?.({
					kind: "ok",
					text:
						result.status === "queued"
							? t("project.deployQueued")
							: t("project.deployDone", { url: result.previewUrl ?? "" }),
				});
			} catch (error) {
				onDone?.({
					kind: "error",
					text: error instanceof Error ? error.message : t("project.deployFailed"),
				});
			} finally {
				setBusy(false);
			}
		})();
	};

	const cloudflareReady = targets?.cloudflare.available ?? false;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger variant="outline" size="sm" disabled={busy}>
				{busy ? t("project.deploying") : t("project.deploy")}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>{t("project.deployWhere")}</DropdownMenuLabel>
				<DropdownMenuItem onSelect={() => deploy("aws")}>
					<span className="flex flex-col">
						<span className="font-medium">{t("project.deployAws")}</span>
						<span className="text-[11px] text-muted-foreground">
							{t("project.deployAwsHint")}
						</span>
					</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!cloudflareReady}
					onSelect={() => deploy("cloudflare")}
				>
					<span className="flex flex-col">
						<span className="font-medium">
							{targets?.cloudflare.connected
								? t("project.deployCfConnected", {
										account: targets.cloudflare.accountName ?? "",
									})
								: t("project.deployCf")}
						</span>
						<span className="text-[11px] text-muted-foreground">
							{cloudflareReady
								? targets?.cloudflare.connected
									? t("project.deployCfHint")
									: t("project.deployCfConnectHint")
								: t("project.deployCfUnavailable")}
						</span>
					</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
