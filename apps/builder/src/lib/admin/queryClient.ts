// TanStack Query istemcisi — sunucu verisinin (GitHub API, taramalar) bellekte
// tek kopyası; eşzamanlı istekler tekilleşir, mutasyon sonrası geçersiz kılınır.

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});
