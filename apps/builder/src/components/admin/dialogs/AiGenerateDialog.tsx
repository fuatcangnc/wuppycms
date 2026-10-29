// "AI ile üret" (P5) — istem + ton/uzunluk/dil/anahtar sözcük; sonuç önizlenir,
// "Gövdeye ekle" ile dokümana girer (kirli işaretlenir; kullanıcı gözden
// geçirip Kaydet'e basar). Sağlayıcı ayarı: Ajan ile kullan → Sağlayıcı (BYO).

import { t } from "@/lib/i18n";
import { useState } from "react";
import { Button } from "@/components/ui-react/button";
import { Dialog, DialogContent, DialogHeader, DialogOverlay, DialogTitle } from "@/components/ui-react/dialog";
import { Input } from "@/components/ui-react/input";
import { Textarea } from "@/components/ui-react/textarea";
import * as api from "@/lib/admin/api";
import { $body, $dirty, $doc } from "@/lib/admin/store";

const SELECT_CLS =
	"border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full appearance-none rounded-lg border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

export default function AiGenerateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [prompt, setPrompt] = useState("");
	const [tone, setTone] = useState("professional");
	const [length, setLength] = useState("medium");
	const [language, setLanguage] = useState("tr");
	const [keyword, setKeyword] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState("");
	const [preview, setPreview] = useState("");

	const generate = async () => {
		if (!prompt.trim() || busy) return;
		setBusy(true);
		setNote("");
		setPreview("");
		try {
			const result = await api.aiGenerate({
				prompt,
				tone,
				length,
				language,
				keyword: keyword.trim() || undefined,
				title: $doc.get()?.values.get("title")?.replace(/^["']|["']$/g, "") || undefined,
			});
			setPreview(result.text);
			setNote(t("aiDialog.generatedNote", { provider: result.provider, model: result.model }));
		} catch (error) {
			setNote(error instanceof Error ? t("aiDialog.error", { message: error.message }) : t("aiDialog.failed"));
		} finally {
			setBusy(false);
		}
	};

	const insert = () => {
		if (!preview.trim()) return;
		$body.set(`${$body.get().trimEnd()}\n\n${preview.trim()}\n`);
		$dirty.set(true);
		setPreview("");
		onClose();
	};

	return (
		<Dialog open={open} onClose={onClose}>
			<DialogOverlay />
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>{t("aiDialog.title")}</DialogTitle>
				</DialogHeader>
				<div className="grid gap-3">
					<Textarea
						aria-label="AI istemi"
						rows={3}
						placeholder={t("aiDialog.promptPlaceholder")}
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
					/>
					<div className="grid grid-cols-3 gap-2">
						<select aria-label="Ton" className={SELECT_CLS} value={tone} onChange={(event) => setTone(event.target.value)}>
							<option value="professional">{t("aiDialog.toneProfessional")}</option>
							<option value="friendly">{t("aiDialog.toneFriendly")}</option>
							<option value="casual">{t("aiDialog.toneCasual")}</option>
							<option value="formal">{t("aiDialog.toneFormal")}</option>
						</select>
						<select aria-label="Uzunluk" className={SELECT_CLS} value={length} onChange={(event) => setLength(event.target.value)}>
							<option value="short">{t("aiDialog.lengthShort")}</option>
							<option value="medium">{t("aiDialog.lengthMedium")}</option>
							<option value="long">{t("aiDialog.lengthLong")}</option>
						</select>
						<select aria-label="Dil" className={SELECT_CLS} value={language} onChange={(event) => setLanguage(event.target.value)}>
							<option value="tr">{t("aiDialog.languageTr")}</option>
							<option value="en">{t("aiDialog.languageEn")}</option>
						</select>
					</div>
					<Input
						aria-label="Anahtar sözcük"
						placeholder={t("aiDialog.keywordPlaceholder")}
						value={keyword}
						onChange={(event) => setKeyword(event.target.value)}
					/>
					<div className="flex items-center gap-3">
						<Button type="button" size="sm" disabled={busy || !prompt.trim()} onClick={() => void generate()}>
							{busy ? t("aiDialog.generating") : t("aiDialog.generate")}
						</Button>
						{note && <span className="text-xs text-muted-foreground">{note}</span>}
					</div>
					{preview && (
						<div className="grid gap-2">
							<pre className="max-h-[30vh] overflow-auto rounded-lg border border-border bg-muted/20 p-3 whitespace-pre-wrap text-xs">{preview}</pre>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="secondary" size="sm" onClick={() => setPreview("")}>
									{t("common.cancel")}
								</Button>
								<Button type="button" size="sm" onClick={insert}>
									{t("aiDialog.insert")}
								</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
