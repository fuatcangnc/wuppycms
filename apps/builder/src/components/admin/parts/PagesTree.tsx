// `src/pages` ağacı — .astro/.md/.mdx/.html dosyaları, klasörler açılır/kapanır.
// Görsel dil Sidebar'ın menü satırlarıyla aynıdır; ayrı bir primitive gerekmez.

import { useMemo, useState } from "react";
import type { PageFile } from "@/lib/admin/api";
import { Icon } from "../parts";

type Node = {
	name: string;
	path: string;
	file: boolean;
	children: Node[];
};

function buildTree(files: PageFile[]): Node[] {
	const root: Node[] = [];
	for (const file of files) {
		const parts = file.path.replace(/^src\/pages\//, "").split("/");
		let level = root;
		parts.forEach((part, index) => {
			const isFile = index === parts.length - 1;
			const path = parts.slice(0, index + 1).join("/");
			let node = level.find((item) => item.name === part && item.file === isFile);
			if (!node) {
				node = { name: part, path, file: isFile, children: [] };
				level.push(node);
			}
			level = node.children;
		});
	}
	const sort = (nodes: Node[]): Node[] => {
		nodes.sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name));
		for (const node of nodes) sort(node.children);
		return nodes;
	};
	return sort(root);
}

const ROW =
	"group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent/60 hover:text-foreground";

export default function PagesTree({
	pages,
	activePath,
	onOpen,
}: {
	pages: PageFile[];
	activePath: string;
	onOpen(path: string): void;
}) {
	const tree = useMemo(() => buildTree(pages), [pages]);
	// Kök ("pages") açık başlar; alt klasörler kapalı (screenshot davranışı).
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
	const toggle = (path: string) =>
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});

	const renderNodes = (nodes: Node[]): React.ReactNode =>
		nodes.map((node) => {
			if (node.file) {
				const active = node.path === activePath;
				return (
					<button
						key={node.path}
						type="button"
						onClick={() => onOpen(node.path)}
						className={`${ROW} ${active ? "bg-accent/70 font-medium text-foreground" : "text-muted-foreground"}`}
						title={`src/pages/${node.path}`}
					>
						<Icon name="file" className="size-3.5 shrink-0 opacity-60" />
						<span className="truncate">{node.name}</span>
					</button>
				);
			}
			const open = expanded.has(node.path);
			return (
				<div key={node.path}>
					<button
						type="button"
						onClick={() => toggle(node.path)}
						className={`${ROW} text-muted-foreground`}
						aria-expanded={open}
					>
						<Icon
							name="chevron-right"
							className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
						/>
						<Icon name="folder" className="size-3.5 shrink-0 opacity-70" />
						<span className="truncate">{node.name}</span>
					</button>
					{open && node.children.length > 0 ? (
						<div className="ml-4 border-l border-border pl-1.5">{renderNodes(node.children)}</div>
					) : null}
				</div>
			);
		});

	return (
		<div className="space-y-0.5">
			<button
				type="button"
				onClick={() => toggle("")}
				className={`${ROW} text-muted-foreground`}
				aria-expanded={expanded.has("")}
			>
				<Icon
					name="chevron-right"
					className={`size-3 shrink-0 transition-transform ${expanded.has("") ? "rotate-90" : ""}`}
				/>
				<Icon name="folder" className="size-3.5 shrink-0 opacity-70" />
				<span className="truncate">pages</span>
			</button>
			{expanded.has("") ? (
				<div className="ml-4 border-l border-border pl-1.5">{renderNodes(tree)}</div>
			) : null}
		</div>
	);
}
