// Admin kabuğu — açılış veri yüklemesi, klavye kısayolları ve görünümler.
// Adres katmanı react-router'dadır: RouteApplier URL'i duruma yansıtır,
// action'lar goTo() ile adrese yazar. İş mantığı actions.ts, durum store.ts.

import { useStore } from "@nanostores/react";
import { useEffect } from "react";
import { bootstrap, saveDoc } from "@/lib/admin/actions";
import { setApplying } from "@/lib/admin/navigate";
import {
	$booted,
	$collection,
	$dialogs,
	$dirty,
	$pageDirty,
	$doc,
	$view,
	closeAllDialogs,
} from "@/lib/admin/store";
import ErrorBanner from "./ErrorBanner";
import { MediaUploadProgress } from "./parts/MediaUploadProgress";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import AgentDialog from "./dialogs/AgentDialog";
import MediaPickerDialog from "./dialogs/MediaPickerDialog";
import NewCollectionDialog from "./dialogs/NewCollectionDialog";
import NewEntryDialog from "./dialogs/NewEntryDialog";
import SiteConfigView from "./views/SiteConfigView";
import PageView from "./views/PageView";
import SiteWizardDialog from "./dialogs/SiteWizardDialog";
import AgentWidget from "./widget/Widget";
import ContentMdView from "./views/ContentMdView";
import DocView from "./views/DocView";
import EmptyView from "./views/EmptyView";
import EntriesView from "./views/EntriesView";
import HintView from "./views/HintView";
import MediaView from "./views/MediaView";
import OverviewView from "./views/OverviewView";
import ReviewView from "./views/ReviewView";
import TrashView from "./views/TrashView";

export default function AdminShell() {
	const view = useStore($view);
	const collectionKey = useStore($collection);
	const dialogs = useStore($dialogs);

	useEffect(() => {
		// Açılış boyunca adres kıpırdamaz; RouteApplier $booted sonrası derin
		// bağlantıyı uygular (geçmiş kirletilmez, eski replaceState kapısı).
		setApplying(true);
		void bootstrap().catch(() => {
			$booted.set(true);
			setApplying(false);
		});
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				closeAllDialogs();
				return;
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				if ($doc.get() && $dirty.get()) void saveDoc();
			}
		};
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if ($dirty.get() || $pageDirty.get()) event.preventDefault();
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("beforeunload", onBeforeUnload);
		};
	}, []);

	return (
		<div className="flex h-screen overflow-hidden">
			<Sidebar />
			<main className="flex min-w-0 flex-1 flex-col">
				<TopBar />
				<ErrorBanner />
				<div className="min-h-0 flex-1 overflow-y-auto">
					{/* Yükleme/klasör ilerlemesi — görünümden bağımsız, en üstte. */}
					<MediaUploadProgress />
					{view === "empty" && <EmptyView />}
					{view === "hint" && <HintView />}
					{view === "overview" && <OverviewView />}
					{/* key: koleksiyon değişince arama/klasör yerel durumu sıfırlanır */}
					{view === "entries" && <EntriesView key={collectionKey} />}
					{view === "doc" && <DocView />}
					{view === "contentmd" && <ContentMdView />}
					{view === "media" && <MediaView />}
					{view === "trash" && <TrashView />}
					{view === "review" && <ReviewView />}
					{view === "settings" && <SiteConfigView />}
					{view === "page" && <PageView />}
				</div>
			</main>
			{dialogs.new && <NewEntryDialog />}
			{dialogs.site && <SiteWizardDialog />}
			{dialogs.ai && <AgentDialog />}
			{dialogs.collection && <NewCollectionDialog />}
			{dialogs.picker && <MediaPickerDialog />}
			<AgentWidget />
		</div>
	);
}
