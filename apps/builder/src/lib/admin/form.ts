// Doküman formunun alan tanımları — koleksiyon şeması + frontmatter'daki
// şemasız anahtarlar. Saf fonksiyon; hem render hem kayıt buradan türetir.

import type { CollectionDef, FieldType } from "@wuppycms/content-schema";
import { inferFieldType } from "./fields";
import type { OpenDoc } from "./store";

export type ControlSpec = {
	name: string;
	label: string;
	type: FieldType;
	required: boolean;
	options?: string[];
};

export function buildControls(def: CollectionDef | undefined, doc: OpenDoc): ControlSpec[] {
	const controls: ControlSpec[] = [];
	const schemaNames = new Set<string>();
	for (const field of def?.fields ?? []) {
		schemaNames.add(field.name);
		controls.push({
			name: field.name,
			label: field.label,
			type: field.type,
			required: field.required,
			options: field.options,
		});
	}
	for (const key of doc.order) {
		if (schemaNames.has(key)) continue;
		controls.push({
			name: key,
			label: `${key} *`,
			type: inferFieldType(doc.values.get(key) ?? ""),
			required: false,
		});
	}
	return controls;
}
