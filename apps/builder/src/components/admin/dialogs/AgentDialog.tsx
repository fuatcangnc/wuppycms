// "Ajan ile kullan" modalı — iki sekme:
//  1) Kodlama ajanı: ajan seç, promptu kopyala (dış ajan kurulumu).
//  2) Sağlayıcı (P5): BYO AI ayarı — OpenAI-uyumlu (OpenAI/Groq/OpenRouter/
//     Ollama…) ya da Gemini; anahtar D1'de şifreli saklanır, tarayıcıya dönmez.

import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-react/tabs";
import * as api from "@/lib/admin/api";
import { closeDialog } from "@/lib/admin/store";
import { DialogShell } from "./DialogShell";

const AGENTS = ["OpenCode", "Claude Code", "Codex", "Cursor", "Gemini CLI"];

const SELECT_CLS =
	"border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full appearance-none rounded-lg border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

function agentPrompt(agent: string): string {
	return [
		`Bu depoyu WuppyCMS için hazırla ( ${agent} ).`,
		"",
		"Depo kökünde `npx create-wuppycms@latest --yes` çalıştır. Bu komut repo içindeki her siteyi bulur,",
		"adresini Astro config'inden okur ve .wuppycms/sites.jsonc dosyasına yazar; zaten kurulu siteleri",
		"değiştirmez. Adresi bulamazsa sitenin gerçek üretim URL'sini kullan. Her sitenin koleksiyon",
		"klasörlerinin (src/content.config.ts) ve medya klasörünün doğru olduğunu kontrol et; sonra",
		".wuppycms klasörünü commit edip push'la. WuppyCMS push'u görünce siteleri kendiliğinden açar.",
	].join("\n");
}

/** Sağlayıcı sekmesi — ayarları yükler, kaydeder, anahtarı asla geri göstermez. */
function ProviderTab() {
	const [provider, setProvider] = useState<"openai" | "gemini" | "anthropic">("openai");
	const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
	const [model, setModel] = useState("gpt-4o-mini");
	const [apiKey, setApiKey] = useState("");
	const [hasKey, setHasKey] = useState(false);
	const [note, setNote] = useState("");

	useEffect(() => {
		void api
			.getAiSettings()
			.then((settings) => {
				setProvider(settings.provider);
				setBaseUrl(settings.baseUrl);
				setModel(settings.model);
				setHasKey(settings.hasKey);
			})
			.catch(() => undefined);
	}, []);

	const save = async () => {
		setNote("");
		try {
			const saved = await api.putAiSettings({
				provider,
				baseUrl,
				model,
				// Boş bırakıldıysa mevcut anahtar korunur (undefined gönderiyoruz).
				apiKey: apiKey.trim() === "" ? undefined : apiKey.trim(),
			});
			setHasKey(saved.hasKey);
			setApiKey("");
			setNote(t("dialog.savedOk"));
		} catch (error) {
			setNote(error instanceof Error ? error.message : t("dialog.saveFailed"));
		}
	};

	return (
		<div className="grid gap-3 pt-2">
			<div className="grid gap-1.5">
				<label className="text-xs font-medium text-muted-foreground">{t("dialog.providerLabel")}</label>
				<select
					className={SELECT_CLS}
					aria-label="AI sağlayıcı"
					value={baseUrl.includes("evren-llmapi") ? "evren" : provider}
					onChange={(event) => {
						const value = event.target.value;
						if (value === "evren") {
							setProvider("openai");
							setBaseUrl("https://evren-llmapi.ssyz.org.tr/v1");
							setModel("deepseek-v4.1-flash");
							return;
						}
						const next = value === "gemini" ? "gemini" : value === "anthropic" ? "anthropic" : "openai";
						setProvider(next);
						if (next === "gemini" && baseUrl === "https://api.openai.com/v1") {
							setBaseUrl("https://generativelanguage.googleapis.com");
							setModel("gemini-2.5-flash");
						} else if (next === "anthropic" && baseUrl === "https://api.openai.com/v1") {
							setBaseUrl("https://api.anthropic.com");
							setModel("claude-sonnet-4-5");
						}
					}}
				>
					<option value="openai">{t("dialog.openaiOption")}</option>
					<option value="evren">Evren LLM (OpenAI-uyumlu)</option>
					<option value="gemini">Gemini</option>
					<option value="anthropic">Anthropic (Claude)</option>
				</select>
			</div>
			<div className="grid gap-1.5">
				<label className="text-xs font-medium text-muted-foreground">{t("dialog.baseUrlLabel")}</label>
				<Input aria-label="AI sunucu adresi" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
				<p className="text-[11px] text-muted-foreground">
					Ollama örneği: <code className="font-mono">http://localhost:11434/v1</code> (anahtarsız çalışır)
				</p>
			</div>
			<div className="grid gap-1.5">
				<label className="text-xs font-medium text-muted-foreground">{t("dialog.modelLabel")}</label>
				<Input aria-label="AI modeli" value={model} onChange={(event) => setModel(event.target.value)} />
			</div>
			<div className="grid gap-1.5">
				<label className="text-xs font-medium text-muted-foreground">{t("dialog.keyLabel")}</label>
				<Input
					type="password"
					aria-label="AI anahtarı"
					placeholder={hasKey ? t("dialog.keyPlaceholderSaved") : t("dialog.keyPlaceholderNew")}
					value={apiKey}
					onChange={(event) => setApiKey(event.target.value)}
				/>
				<p className="text-[11px] text-muted-foreground">
					{t("dialog.keyNote")}
				</p>
			</div>
			<div className="flex items-center gap-3">
				<Button type="button" size="sm" onClick={() => void save()}>
					Kaydet
				</Button>
				{note && <span className="text-xs text-muted-foreground">{note}</span>}
			</div>
		</div>
	);
}

export default function AgentDialog() {
	const [agent, setAgent] = useState("OpenCode");
	const [copiedMain, setCopiedMain] = useState(false);
	const [copiedCli, setCopiedCli] = useState(false);
	const [tab, setTab] = useState("agent");

	return (
		<DialogShell panelClassName="sm:max-w-2xl max-h-[86vh] overflow-y-auto" onClose={() => closeDialog("ai")}>
			<Tabs value={tab} onValueChange={setTab}>
				<TabsList>
					<TabsTrigger value="agent">{t("dialog.agentTab")}</TabsTrigger>
					<TabsTrigger value="provider">{t("dialog.providerTab")}</TabsTrigger>
				</TabsList>
				<TabsContent value="agent">
					<h3 className="mt-3 text-sm font-semibold">{t("dialog.agentTitle")}</h3>
					<p className="mt-1 text-xs text-muted-foreground">{t("dialog.agentBody")}</p>
					<div className="mt-4 flex flex-wrap gap-1.5">
						{AGENTS.map((name) => (
							<button
								key={name}
								type="button"
								onClick={() => setAgent(name)}
								className={`rounded-full border px-3 py-1 text-xs transition-colors ${
									name === agent
										? "border-primary bg-primary/10 font-medium text-foreground"
										: "border-border text-muted-foreground hover:text-foreground"
								}`}
							>
								{name}
							</button>
						))}
					</div>
					<div className="relative mt-3">
						<textarea
							rows={6}
							readOnly
							spellCheck={false}
							value={agentPrompt(agent)}
							className="w-full rounded-lg border border-border bg-muted/30 p-3 pr-10 font-mono text-xs outline-none"
						/>
						<button
							type="button"
							title={t("common.copy")}
							onClick={() => {
								void navigator.clipboard?.writeText(agentPrompt(agent));
								setCopiedMain(true);
								setTimeout(() => setCopiedMain(false), 1200);
							}}
							className={`absolute right-2 top-2 rounded-md border border-border bg-background p-1.5 transition-colors hover:text-foreground ${
								copiedMain ? "text-emerald-500" : "text-muted-foreground"
							}`}
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
						</button>
					</div>
					<p className="mt-3 text-xs font-medium">{t("dialog.runYourself")}</p>
					<div className="mt-1.5 flex items-center justify-between rounded-lg border border-border px-3 py-2">
						<code className="font-mono text-xs">npx create-wuppycms@latest --yes</code>
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard?.writeText("npx create-wuppycms@latest --yes");
								setCopiedCli(true);
								setTimeout(() => setCopiedCli(false), 1200);
							}}
							className="text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							{copiedCli ? "kopyalandı ✓" : "kopyala"}
						</button>
					</div>
				</TabsContent>
				<TabsContent value="provider">
					<h3 className="mt-3 text-sm font-semibold">{t("dialog.providerTitle")}</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("dialog.providerBody")}
					</p>
					<ProviderTab />
				</TabsContent>
			</Tabs>
			<div className="mt-4 flex justify-end">
				<Button variant="secondary" size="sm" onClick={() => closeDialog("ai")}>{t("common.close")}</Button>
			</div>
		</DialogShell>
	);
}
