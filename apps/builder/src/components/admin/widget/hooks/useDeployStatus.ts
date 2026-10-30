// Etkin önizlemenin yayın durumu — build sürerken kullanıcıya "yayınlanıyor"
// göstergesi çıkar, bitince iframe kendini yeniler.

import { useQuery } from "@tanstack/react-query";

export type DeployJob = {
	id: string;
	repo_full_name: string;
	status: "queued" | "deployed" | "failed";
	url: string | null;
	preview_url: string | null;
	error: string | null;
	updated_at: string;
};

export type DeployStatusData = { job: DeployJob | null };

async function fetchDeployStatus(url: string): Promise<DeployStatusData> {
	const res = await fetch(`/api/deploy/status?url=${encodeURIComponent(url)}`, {
		headers: { accept: "application/json" },
	});
	if (!res.ok) return { job: null };
	const data = (await res.json()) as { jobs?: DeployJob[] };
	return { job: data.jobs?.[0] ?? null };
}

export function useDeployStatus(url: string | null) {
	return useQuery({
		queryKey: ["deploy-status", url],
		enabled: Boolean(url),
		queryFn: () => fetchDeployStatus(url as string),
		staleTime: 2000,
		// Yalnızca kuyrukta/derleniyorken sık sor; durunca sorgu durur.
		refetchInterval: (query) =>
			query.state.data?.job?.status === "queued" ? 4000 : false,
		refetchOnWindowFocus: true,
	});
}
