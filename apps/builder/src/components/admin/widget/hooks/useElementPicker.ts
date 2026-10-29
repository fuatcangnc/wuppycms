// Element seçici — site önizlemesiyle postMessage köprüsü üzerinden konuşur
// (ADR 0008). Cross-origin iframe'e doğrudan erişilmez; köprü site şablonunda.

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickedElement } from "../types";

type BridgeMessage =
	| { type: "wuppycms:ready"; capabilities?: { softRefresh?: boolean; skeleton?: boolean } }
	| { type: "wuppycms:pick"; selection: PickedElement; additive?: boolean }
	| { type: "wuppycms:page"; path: string; title?: string }
	| { type: "wuppycms:navigate"; href: string }
	| { type: "wuppycms:soft-refreshed"; requestId?: string; ok?: boolean };

export interface ElementPickerApi {
	selMode: boolean;
	bridgeReady: boolean;
	softRefreshSupported: boolean;
	selections: PickedElement[];
	pagePath: string | null;
	toggleSelMode(): void;
	setSelMode(value: boolean): void;
	toggleSelection(selection: PickedElement): void;
	setSelectionPosition(path: string, label: string, position: "before" | "after"): void;
	showSkeleton(selection: PickedElement, message?: string): void;
	clearSkeleton(): void;
	softRefresh(path?: string | null): Promise<boolean>;
	clearSelections(): void;
	handshake(): void;
	reset(): void;
	command(name: "reload" | "back" | "forward"): void;
}

export function useElementPicker(opts: {
	frameRef: React.RefObject<HTMLIFrameElement | null>;
	onNavigate(href: string): void;
	onPage?(path: string, title?: string): void;
}): ElementPickerApi {
	const { frameRef, onNavigate, onPage } = opts;
	const [selMode, setSelModeState] = useState(false);
	const [bridgeReady, setBridgeReady] = useState(false);
	const [softRefreshSupported, setSoftRefreshSupported] = useState(false);
	const [selections, setSelections] = useState<PickedElement[]>([]);
	const [pagePath, setPagePath] = useState<string | null>(null);

	const selRef = useRef(false);
	const bridgeRef = useRef(false);
	const softWaiters = useRef(new Map<string, (ok: boolean) => void>());
	const live = useRef({ onNavigate, onPage });
	live.current = { onNavigate, onPage };

	const post = useCallback(
		(message: Record<string, unknown>) => {
			const frame = frameRef.current;
			if (!frame?.contentWindow) return;
			// Hedef origin bilinmiyor (müşteri sitesi farklı origin olabilir); veri
			// yalnız seçim/gezinme komutudur, sır taşımaz.
			frame.contentWindow.postMessage(message, "*");
		},
		[frameRef],
	);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const frame = frameRef.current;
			if (!frame || event.source !== frame.contentWindow) return;
			const data = event.data as BridgeMessage | null;
			if (!data || typeof data.type !== "string") return;
			if (data.type === "wuppycms:ready") {
				bridgeRef.current = true;
				setBridgeReady(true);
				setSoftRefreshSupported(Boolean(data.capabilities?.softRefresh));
				post({ type: "wuppycms:pick-mode", on: selRef.current });
				return;
			}
			if (data.type === "wuppycms:pick" && data.selection) {
				const next: PickedElement = {
					...data.selection,
					position: data.selection.position === "before" ? "before" : "after",
				};
				const keyOf = (item: PickedElement) => `${item.path}|${item.label}`;
				setSelections((current) => {
					const same = current.find((item) => keyOf(item) === keyOf(next));
					if (data.additive) {
						if (same) {
							post({ type: "wuppycms:unpick", path: next.path, label: next.label });
							return current.filter((item) => keyOf(item) !== keyOf(next));
						}
						return [...current, next].slice(0, 6);
					}
					// Tek seçim: önceki seçimleri iframe'de de bırak.
					for (const previous of current) {
						if (keyOf(previous) !== keyOf(next)) {
							post({ type: "wuppycms:unpick", path: previous.path, label: previous.label });
						}
					}
					if (same) {
						post({ type: "wuppycms:unpick", path: next.path, label: next.label });
						return [];
					}
					return [next];
				});
				return;
			}
			if (data.type === "wuppycms:page") {
				setPagePath(data.path);
				live.current.onPage?.(data.path, data.title);
				return;
			}
			if (data.type === "wuppycms:navigate") {
				live.current.onNavigate(data.href);
				return;
			}
			if (data.type === "wuppycms:soft-refreshed") {
				const requestId = data.requestId;
				if (!requestId) return;
				const resolve = softWaiters.current.get(requestId);
				if (!resolve) return;
				softWaiters.current.delete(requestId);
				resolve(Boolean(data.ok));
			}
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [frameRef, post]);

	const handshake = useCallback(() => {
		bridgeRef.current = false;
		setBridgeReady(false);
		setSoftRefreshSupported(false);
		post({ type: "wuppycms:hello" });
	}, [post]);

	const setSelMode = useCallback(
		(value: boolean) => {
			selRef.current = value;
			setSelModeState(value);
			post({ type: "wuppycms:pick-mode", on: value });
		},
		[post],
	);

	const toggleSelMode = useCallback(() => setSelMode(!selRef.current), [setSelMode]);

	const toggleSelection = useCallback(
		(selection: PickedElement) => {
			setSelections((current) => {
				const exists = current.some(
					(item) => item.path === selection.path && item.label === selection.label,
				);
				if (exists) {
					post({ type: "wuppycms:unpick", path: selection.path, label: selection.label });
					post({ type: "wuppycms:skeleton-clear" });
					return current.filter(
						(item) => !(item.path === selection.path && item.label === selection.label),
					);
				}
				return [...current, selection].slice(0, 6);
			});
		},
		[post],
	);

	const setSelectionPosition = useCallback(
		(path: string, label: string, position: "before" | "after") => {
			setSelections((current) =>
				current.map((selection) =>
					selection.path === path && selection.label === label
						? { ...selection, position }
						: selection,
				),
			);
			post({ type: "wuppycms:place", path, label, position, scroll: true });
		},
		[post],
	);

	const showSkeleton = useCallback(
		(selection: PickedElement, message?: string) => {
			post({
				type: "wuppycms:skeleton",
				path: selection.path,
				label: selection.label,
				position: selection.position === "before" ? "before" : "after",
				message,
			});
		},
		[post],
	);

	const clearSkeleton = useCallback(() => {
		post({ type: "wuppycms:skeleton-clear" });
	}, [post]);

	const softRefresh = useCallback(
		(path?: string | null) =>
			new Promise<boolean>((resolve) => {
				const requestId = `sr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
				const timeout = window.setTimeout(() => {
					softWaiters.current.delete(requestId);
					resolve(false);
				}, 8000);
				softWaiters.current.set(requestId, (ok) => {
					window.clearTimeout(timeout);
					resolve(ok);
				});
				post({ type: "wuppycms:soft-refresh", path: path ?? undefined, requestId });
			}),
		[post],
	);

	const clearSelections = useCallback(() => {
		setSelections((current) => {
			for (const selection of current) {
				post({ type: "wuppycms:unpick", path: selection.path, label: selection.label });
			}
			return [];
		});
	}, [post]);

	const reset = useCallback(() => {
		bridgeRef.current = false;
		setBridgeReady(false);
		setSoftRefreshSupported(false);
		setSelections([]);
		post({ type: "wuppycms:skeleton-clear" });
	}, [post]);

	const command = useCallback(
		(name: "reload" | "back" | "forward") => {
			post({ type: `wuppycms:${name}` });
		},
		[post],
	);

	return {
		selMode,
		bridgeReady,
		softRefreshSupported,
		selections,
		pagePath,
		toggleSelMode,
		setSelMode,
		toggleSelection,
		setSelectionPosition,
		showSkeleton,
		clearSkeleton,
		softRefresh,
		clearSelections,
		handshake,
		reset,
		command,
	};
}
