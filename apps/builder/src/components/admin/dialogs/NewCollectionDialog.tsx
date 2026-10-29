// Add Collection sihirbazı (parity) — src/content.config.ts'e yeni
// defineCollection bloğu ekler ve exports listesini günceller; her şey normal
// bir commit'tir (ADR 0006). Şablon: title zorunlu + seçilen alanlar opsiyonel.

import { t } from "@/lib/i18n";
import { useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { Label } from "@/components/ui-react/label";
import * as api from "@/lib/admin/api";
import { refreshCollections } from "@/lib/admin/actions";
import { closeDialog, currentSite, showError } from "@/lib/admin/store";
import { DialogShell } from "./DialogShell";

export default function NewCollectionDialog() {
	const [key, setKey] = useState("");
	const [base, setBase] = useState("");
	const [pattern, setPattern] = useState("**/*.mdx");
	const [fields, setFields] = useState<string[]>(["description", "date"]);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState("");

	const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
	const effectiveBase = base.trim() || (cleanKey ? `src/content/${cleanKey}` : "");

	const toggleField = (field: string) => {
		setFields((current) =>
			current.includes(field) ? current.filter((f) => f !== field) : [...current, field],
		);
	};

	const save = async () => {
		const site = currentSite();
		if (!site || busy) return;
		if (!/^[a-zA-Z][\w-]*$/.test(cleanKey)) {
			setNote(t("dialog.collectionKeyInvalid"));
			return;
		}
		setBusy(true);
		setNote("");
		try {
			await api.createCollection(site.repoFullName, {
				key: cleanKey,
				base: effectiveBase,
				pattern: pattern.trim() || "**/*.mdx",
				fields,
			});
			await refreshCollections();
			closeDialog("collection");
		} catch (error) {
			const message = error instanceof Error ? error.message : t("dialog.collectionFailed");
			setNote(message);
			showError(message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<DialogShell panelClassName="sm:max-w-lg" onClose={() => closeDialog("collection")}>
			<h3 className="text-sm font-semibold">{t("dialog.collectionTitle")}</h3>
			<p className="mt-1 text-xs text-muted-foreground">
				src/content.config.ts'e yeni bir <code className="font-mono">defineCollection</code> bloğu yazılır ve
				commit edilir.
			</p>
			<div className="mt-4 grid gap-3">
				<Label className="items-start gap-1 text-xs">
					{t("dialog.collectionKeyLabel")}
					<Input
						aria-label="Koleksiyon anahtarı"
						placeholder={t("dialog.collectionKeyPlaceholder")}
						value={key}
						onChange={(event) => setKey(event.target.value)}
					/>
				</Label>
				<Label className="items-start gap-1 text-xs">
					{t("dialog.collectionBaseLabel")}
					<Input
						aria-label="Koleksiyon klasörü"
						placeholder={effectiveBase || "src/content/koleksiyon"}
						value={base}
						onChange={(event) => setBase(event.target.value)}
					/>
				</Label>
				<Label className="items-start gap-1 text-xs">
					{t("dialog.collectionPatternLabel")}
					<Input
						aria-label="Dosya deseni"
						value={pattern}
						onChange={(event) => setPattern(event.target.value)}
					/>
				</Label>
				<div className="flex items-center gap-4 text-xs">
					<span className="text-muted-foreground">{t("dialog.collectionFieldsLabel")}</span>
					{[
						{ id: "description", label: t("dialog.fieldDescription") },
						{ id: "date", label: t("dialog.fieldDate") },
					].map((option) => (
						<label key={option.id} className="flex items-center gap-1.5">
							<input
								type="checkbox"
								className="size-3.5 accent-primary"
								checked={fields.includes(option.id)}
								onChange={() => toggleField(option.id)}
							/>
							{option.label}
						</label>
					))}
				</div>
				{note && <p className="text-xs text-destructive">{note}</p>}
			</div>
			<div className="mt-4 flex justify-end gap-2">
				<Button variant="secondary" size="sm" onClick={() => closeDialog("collection")}>
					{t("common.close")}
				</Button>
				<Button size="sm" disabled={busy || !cleanKey} onClick={() => void save()}>
					{busy ? t("dialog.collectionCreating") : t("dialog.collectionCreate")}
				</Button>
			</div>
		</DialogShell>
	);
}
