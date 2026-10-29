// "Yeni içerik" diyaloğu — başlıktan slug üretir, dosyayı oluşturup editörde açar.

import { t } from "@/lib/i18n";
import { useState } from "react";
import { slugify } from "@wuppycms/content-schema";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { createEntry } from "@/lib/admin/actions";
import { closeDialog } from "@/lib/admin/store";
import { DialogShell } from "./DialogShell";

export default function NewEntryDialog() {
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [slugEdited, setSlugEdited] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		if (!title.trim()) {
			setError(t("entry.nameRequired"));
			return;
		}
		setBusy(true);
		setError("");
		try {
			await createEntry(title.trim(), slug.trim() || undefined);
			closeDialog("new");
		} catch (err) {
			setError(err instanceof Error ? err.message : t("entry.failed"));
		} finally {
			setBusy(false);
		}
	};

	return (
		<DialogShell panelClassName="sm:max-w-md" onClose={() => closeDialog("new")}>
			<h3 className="mb-4 text-sm font-semibold">{t("entry.title")}</h3>
			<div className="grid gap-3">
				<div className="grid gap-1.5">
					<label htmlFor="new-title" className="text-xs font-medium text-muted-foreground">{t("entry.nameLabel")}</label>
					<Input
						id="new-title"
						autoFocus
						placeholder={t("entry.namePlaceholder")}
						value={title}
						onChange={(event) => {
							setTitle(event.target.value);
							if (!slugEdited) setSlug(slugify(event.target.value));
						}}
					/>
				</div>
				<div className="grid gap-1.5">
					<label htmlFor="new-slug" className="text-xs font-medium text-muted-foreground">{t("entry.slugLabel")}</label>
					<Input
						id="new-slug"
						placeholder={t("entry.slugPlaceholder")}
						spellCheck={false}
						value={slug}
						onChange={(event) => {
							setSlugEdited(true);
							setSlug(event.target.value);
						}}
					/>
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<div className="mt-1 flex justify-end gap-2">
					<Button variant="secondary" size="sm" onClick={() => closeDialog("new")}>{t("common.cancel")}</Button>
					<Button size="sm" disabled={busy} onClick={() => void submit()}>{t("entry.create")}</Button>
				</div>
			</div>
		</DialogShell>
	);
}
