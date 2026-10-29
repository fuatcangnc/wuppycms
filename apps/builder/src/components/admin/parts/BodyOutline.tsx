// Gövde taslağı — Wryte "Outline" paneli karşılığı. Markdown gövdesindeki
// H1-H3 başlıklarını listeler; tıklayınca editördeki başlığa kaydırır.
// Saf regex; mdxeditor'a dokunmaz (mevcut işlevler değişmez).

import { useMemo } from "react";
import { t } from "@/lib/i18n";

type Heading = { level: number; text: string };

export function parseOutline(body: string): Heading[] {
	const headings: Heading[] = [];
	for (const line of body.split("\n")) {
		const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
		if (!match) continue;
		// Markdown vurgularını temizle (görünen metin eşleşmesi için).
		const text = match[2]!.replace(/[*_`]/g, "").trim();
		if (text) headings.push({ level: match[1]!.length, text });
	}
	return headings;
}

export default function BodyOutline({ body, onClose }: { body: string; onClose?: () => void }) {
	const headings = useMemo(() => parseOutline(body), [body]);

	/** Editördeki başlık öğesine kaydır (metin eşleşmesi; benzersizse). */
	const jump = (text: string) => {
		const editor = document.querySelector(".mdx-body-editor");
		if (!editor) return;
		const target = [...editor.querySelectorAll("h1, h2, h3")].find(
			(node) => (node.textContent ?? "").trim() === text,
		);
		target?.scrollIntoView({ block: "center", behavior: "smooth" });
	};

	return (
		<div data-panel="outline">
			<div className="mb-3 flex items-center justify-between gap-2">
				<p className="text-sm font-medium text-foreground">
					{t("docview.panelOutline")}
				</p>
				{onClose && (
					<button
						type="button"
						className="text-[11px] text-muted-foreground hover:text-foreground"
						title={t("common.close")}
						onClick={onClose}
					>
						✕
					</button>
				)}
			</div>
			{headings.length === 0 ? (
				<p className="text-[11px] text-muted-foreground">
					{t("docview.outlineEmpty")}
				</p>
			) : (
				<ul className="grid gap-0.5">
					{headings.map((heading, index) => (
						<li key={`${index}-${heading.text}`} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
							<button
								type="button"
								className="w-full truncate rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
								title={heading.text}
								onClick={() => jump(heading.text)}
							>
								{heading.text}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
