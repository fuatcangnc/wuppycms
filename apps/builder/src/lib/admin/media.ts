// Medya iş katmanı — tek giriş noktası (barel). Uygulama kodu her zaman
// "@/lib/admin/media"dan import eder; gerçek kod cohesive parçalardadır:
//   media-core.ts  → tipler, tür sınıflandırma, D1 meta, bağ/önizleme
//   media-list.ts  → liste tazeleme, kitaplık/klasör gezinme, seçici
//   media-write.ts → yükleme, silme/taşıma/değiştirme, kullanım, klasör
// Bağımlılık yönü yalnız core ← list ← write'dur; bu dosya yeniden dışa
// aktarır (actions.ts uyumluluk katmanı da buradan beslenir).

export {
	entryMediaScope,
	mediaAltFor,
	mediaCaptionFor,
	mediaKindOf,
	mediaLinkFor,
	mediaPreviewUrl,
	mediaSrcForEditor,
	r2RawUrl,
	saveMediaMeta,
	setMediaAlt,
	type MediaItem,
	type MediaKind,
	type UploadOutcome,
} from "./media-core";
export {
	loadMoreMedia,
	openMedia,
	pickMedia,
	refreshMedia,
	resolveMediaPick,
	closeMediaPicker,
	setMediaFolder,
	setMediaLibrary,
} from "./media-list";
export {
	cleanFolderName,
	createMediaFolder,
	deleteMedia,
	moveMediaTo,
	replaceMedia,
	scanUsage,
	uploadCroppedCopy,
	uploadMedia,
	type MediaUsageScan,
} from "./media-write";
