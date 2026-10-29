/** Markdown → React (ham HTML yok). Tailwind utility sınıfları; custom CSS yok. */

import type { ReactNode } from "react";
import type { Block, Inline } from "./lib/markdown";
import { parseMarkdown } from "./lib/markdown";

function renderInline(nodes: Inline[], keyPrefix: string): ReactNode[] {
	return nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;
		switch (node.type) {
			case "strong":
				return (
					<strong key={key} className="font-semibold text-foreground">
						{renderInline(node.children, key)}
					</strong>
				);
			case "em":
				return <em key={key}>{renderInline(node.children, key)}</em>;
			case "code":
				return (
					<code
						key={key}
						className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground"
					>
						{node.value}
					</code>
				);
			case "link":
				return (
					<a
						key={key}
						href={node.href}
						target="_blank"
						rel="noreferrer noopener"
						className="text-primary underline underline-offset-2 hover:opacity-80"
					>
						{node.children.length ? renderInline(node.children, key) : node.href}
					</a>
				);
			default:
				return node.value;
		}
	});
}

function renderLines(lines: Inline[][], keyPrefix: string): ReactNode[] {
	return lines.map((line, index) => (
		<span key={`${keyPrefix}-l${index}`} className="block">
			{renderInline(line, `${keyPrefix}-${index}`)}
		</span>
	));
}

function renderBlock(block: Block, index: number, onCopy?: (text: string) => void): ReactNode {
	const key = `b${index}`;
	switch (block.type) {
		case "heading": {
			const sizes = {
				1: "text-lg font-semibold",
				2: "text-base font-semibold",
				3: "text-sm font-semibold",
				4: "text-sm font-medium",
			} as const;
			const Tag = (`h${block.level}` as const) satisfies keyof React.JSX.IntrinsicElements as
				| "h1"
				| "h2"
				| "h3"
				| "h4";
			return (
				<Tag key={key} className={`mt-3 mb-1.5 text-foreground ${sizes[block.level]}`}>
					{renderInline(block.content, key)}
				</Tag>
			);
		}
		case "list":
			return block.ordered ? (
				<ol key={key} className="my-2 list-decimal space-y-1 pl-5">
					{block.items.map((item, i) => (
						<li key={`${key}-i${i}`}>{renderInline(item, `${key}-i${i}`)}</li>
					))}
				</ol>
			) : (
				<ul key={key} className="my-2 list-disc space-y-1 pl-5">
					{block.items.map((item, i) => (
						<li key={`${key}-i${i}`}>{renderInline(item, `${key}-i${i}`)}</li>
					))}
				</ul>
			);
		case "quote":
			return (
				<blockquote key={key} className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
					{renderLines(block.lines, key)}
				</blockquote>
			);
		case "code":
			return (
				<div key={key} className="my-2 overflow-hidden rounded-lg border border-border">
					<div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
						<span className="font-mono text-[11px] text-muted-foreground">{block.lang || "code"}</span>
						{onCopy ? (
							<button
								type="button"
								className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
								onClick={() => onCopy(block.value)}
							>
								Copy
							</button>
						) : null}
					</div>
					<pre className="overflow-x-auto bg-muted/20 p-3">
						<code className="font-mono text-xs text-foreground">{block.value}</code>
					</pre>
				</div>
			);
		case "hr":
			return <hr key={key} className="my-3 border-border" />;
		default:
			return (
				<p key={key} className="my-1.5">
					{renderLines(block.lines, key)}
				</p>
			);
	}
}

export function Markdown({ text, onCopy }: { text: string; onCopy?(text: string): void }) {
	const blocks = parseMarkdown(text);
	if (!blocks.length) return null;
	return (
		<div className="text-sm leading-relaxed text-foreground/90">
			{blocks.map((block, index) => renderBlock(block, index, onCopy))}
		</div>
	);
}
