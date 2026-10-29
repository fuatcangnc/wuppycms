// Astro sayfası kaynak editörü — `src/pages` altındaki .astro/.md/.mdx/.html.
// Kaydet = repoda gerçek commit; iyimser eşzamanlılık için SHA kontrol edilir.

import { useStore } from "@nanostores/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui-react/button";
import * as api from "@/lib/admin/api";
import { $pageDirty, $pagePath, $site, $sites } from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { Icon } from "../parts";

const MonacoEditor = lazy(() => import("../parts/MonacoEditor"));

export default function PageView() {
	const repo = useStore($site);
	const branch = useStore($sites).find((item) => item.repoFullName === repo)?.branch ?? "main";
	const pagePath = useStore($pagePath);
	const [content, setContent] = useState("");
	const [saved, setSaved] = useState("");
	const [sha, setSha] = useState("");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const loadSeq = useRef(0);

	const relPath = pagePath.replace(/^src\/pages\//, "").replace(/^\/+/, "");
	const repoPath = relPath ? `src/pages/${relPath}` : "";
	const language = /\.mdx?$/i.test(relPath) ? "markdown" : /\.(astro|html?)$/i.test(relPath) ? "html" : "plaintext";
	const [theme, setTheme] = useState<"light" | "dark">(() =>
		typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
	);

	useEffect(() => {
		const root = document.documentElement;
		const observer = new MutationObserver(() =>
			setTheme(root.classList.contains("dark") ? "dark" : "light"),
		);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const load = async () => {
		if (!repo || !repoPath) return;
		const seq = ++loadSeq.current;
		setLoading(true);
		setError("");
		try {
			const file = await api.getFile(repo, repoPath);
			if (seq !== loadSeq.current) return;
			setContent(file.content);
			setSaved(file.content);
			setSha(file.sha);
		} catch (err) {
			if (seq !== loadSeq.current) return;
			setError(err instanceof Error ? err.message : t("page.loadFailed"));
			setContent("");
			setSaved("");
			setSha("");
		} finally {
			if (seq === loadSeq.current) setLoading(false);
		}
	};

	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- site/sayfa değişince yükle
	}, [repo, branch, repoPath]);

	const dirty = content !== saved;
	useEffect(() => {
		$pageDirty.set(dirty);
		return () => $pageDirty.set(false);
	}, [dirty]);

	const save = async () => {
		if (!repo || !repoPath || !dirty || saving) return;
		setSaving(true);
		setError("");
		try {
			// İyimser eşzamanlılık: dosya bizde açıkken değiştiyse üzerine yazma.
			const current = await api.getFile(repo, repoPath);
			if (sha && current.sha !== sha) {
				setError(t("page.conflict"));
				return;
			}
			await api.commitFiles(repo, branch, `cms: ${repoPath} güncellendi (via WuppyCMS)`, [
				{ path: repoPath, content },
			]);
			const next = await api.getFile(repo, repoPath);
			setSaved(content);
			setSha(next.sha);
		} catch (err) {
			setError(err instanceof Error ? err.message : t("page.saveFailed"));
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				void save();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	if (!relPath) {
		return <div className="p-6 text-sm text-muted-foreground">{t("page.hint")}</div>;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
				<Icon name="file" className="size-4 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{repoPath}</span>
				{dirty ? (
					<span data-testid="page-status" className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
						{t("topbar.dirty")}
					</span>
				) : (
					<span data-testid="page-status" className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
						{t("topbar.saved")}
					</span>
				)}
				<Button
					type="button"
					variant="secondary"
					size="sm"
					disabled={!dirty || saving}
					onClick={() => {
						setContent(saved);
						setError("");
					}}
				>
					{t("common.cancel")}
				</Button>
				<Button type="button" size="sm" data-testid="page-save" disabled={!dirty || saving} onClick={() => void save()}>
					{saving ? t("topbar.saving") : t("common.save")}
				</Button>
			</div>
			{error ? <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</p> : null}
			<div className="min-h-0 flex-1" data-testid="page-editor">
				{loading ? (
					<div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
				) : (
					<Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>}>
						<MonacoEditor
							value={content}
							language={language}
							theme={theme}
							onChange={setContent}
							onSave={() => void save()}
						/>
					</Suspense>
				)}
			</div>
			<p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
				{t("page.hint")} · Ctrl/⌘+S
			</p>
		</div>
	);
}
