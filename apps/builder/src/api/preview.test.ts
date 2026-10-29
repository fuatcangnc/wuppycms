// Önizleme proxy'sinin URL yeniden yazımı — kök göreli yollar önek altında kalmalı.

import { describe, expect, it } from "vitest";
import { rewriteCss, rewriteHtml } from "./preview";

const P = "/preview/wuppy-a-b-12345";

describe("rewriteHtml", () => {
	it("kök göreli href/src/action yollarını önekler", () => {
		const out = rewriteHtml(
			'<a href="/about">A</a><img src="/x.png"><form action="/send"></form>',
			P,
		);
		expect(out).toContain(`href="${P}/about"`);
		expect(out).toContain(`src="${P}/x.png"`);
		expect(out).toContain(`action="${P}/send"`);
	});

	it("protokol-göreli ve mutlak URL'lere dokunmaz", () => {
		const out = rewriteHtml('<img src="//cdn.example/x.png"><a href="https://x.test/a">x</a>', P);
		expect(out).toContain('src="//cdn.example/x.png"');
		expect(out).toContain('href="https://x.test/a"');
	});

	it("inline modül import yollarını önekler", () => {
		const out = rewriteHtml('<script>import("/scripts/motion-init.js")</script>', P);
		expect(out).toContain(`import("${P}/scripts/motion-init.js")`);
	});

	it("srcset adaylarını önekler", () => {
		const out = rewriteHtml('<img srcset="/a.png 1x, /b.png 2x">', P);
		expect(out).toContain(`srcset="${P}/a.png 1x, ${P}/b.png 2x"`);
	});
});

describe("rewriteCss", () => {
	it("url() ve @import yollarını önekler", () => {
		const out = rewriteCss('@import "/x.css"; .a{background:url(/img/a.png)}', P);
		expect(out).toContain(`@import "${P}/x.css"`);
		expect(out).toContain(`url(${P}/img/a.png)`);
	});

	it("veri ve mutlak URL'leri korur", () => {
		const out = rewriteCss('.a{background:url(data:image/png;base64,xx)}', P);
		expect(out).toContain("url(data:image/png;base64,xx)");
	});
});
