// Monaco Editor — yalnız istemcide, PageView tarafından dinamik import edilir.
// Astro için özel bir Monaco dili yok; .astro/.html için `html`, .md/.mdx için
// `markdown` kullanılır. Worker'lar Vite `?worker` ile yerelden yüklenir (CDN yok).

import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/language/json/json.worker?worker";
import cssWorker from "monaco-editor/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/language/html/html.worker?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker?worker";

type MonacoEnvironmentShape = {
	getWorker(moduleId: string, label: string): Worker;
};

if (typeof window !== "undefined") {
	(window as unknown as { MonacoEnvironment: MonacoEnvironmentShape }).MonacoEnvironment = {
		getWorker(_moduleId, label) {
			if (label === "json") return new jsonWorker();
			if (label === "css" || label === "scss" || label === "less") return new cssWorker();
			if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
			if (label === "typescript" || label === "javascript") return new tsWorker();
			return new editorWorker();
		},
	};
	loader.config({ monaco });
	// Test/hata ayıklama köprüsü: model değerini deterministik okumak/yazmak için.
	(window as unknown as { __wuppycmsMonaco?: typeof monaco }).__wuppycmsMonaco = monaco;
}

export default function MonacoEditor({
	value,
	language,
	theme,
	onChange,
	onSave,
}: {
	value: string;
	language: string;
	theme: "light" | "dark";
	onChange(value: string): void;
	onSave(): void;
}) {
	return (
		<Editor
			height="100%"
			language={language}
			value={value}
			theme={theme === "dark" ? "vs-dark" : "light"}
			onChange={(next) => onChange(next ?? "")}
			onMount={(editor, api) => {
				editor.addCommand(api.KeyMod.CtrlCmd | api.KeyCode.KeyS, () => onSave());
				editor.focus();
			}}
			options={{
				minimap: { enabled: false },
				fontFamily: "JetBrains Mono Variable, monospace",
				fontSize: 12,
				lineHeight: 18,
				wordWrap: "on",
				scrollBeyondLastLine: false,
				automaticLayout: true,
				tabSize: 2,
				renderWhitespace: "selection",
				padding: { top: 12, bottom: 12 },
			}}
		/>
	);
}
