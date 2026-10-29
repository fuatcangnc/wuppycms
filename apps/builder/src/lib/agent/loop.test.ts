import { describe, expect, it } from "vitest";
import { selectionBlock } from "./loop";

describe("selectionBlock", () => {
	it("seçili elementin ekleme konumunu isteme taşır", () => {
		const block = selectionBlock([
			{
				tag: "section",
				label: "section#hakkimizda",
				path: "main > section:nth-of-type(2)",
				text: "Hakkımızda",
				position: "before",
			},
		]);

		expect(block).toContain("[SELECTED ELEMENTS]");
		expect(block).toContain("insert: before");
		expect(block).toContain("css: main > section:nth-of-type(2)");
		expect(block).toContain('text: "Hakkımızda"');
	});

	it("konum verilmezse insert satırı eklemez (metin/renk düzenlemesi)", () => {
		const block = selectionBlock([{ tag: "div", path: "main > div" }]);
		expect(block).not.toContain("insert:");
	});
});
