// GitHub dosya okuma uçları — contents API + blob API (1 MB üzeri dosyalar).

import type { GitFile } from "@wuppycms/shared";
import { BackendError } from "../backend";
import { gh, splitFullName } from "./api";

type GhContentsFile = {
	type: string;
	path: string;
	sha: string;
	encoding: string;
	content?: string;
};

function decodeBase64Text(base64: string): string {
	const binary = atob(base64.replace(/\n/g, ""));
	const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/** Tek dosyayı okur; içerik gömülü gelmezse (büyük dosya) blob API'sine düşer. */
export async function getFile(
	token: string,
	fullName: string,
	path: string,
	ref?: string,
): Promise<GitFile> {
	const { owner, repo } = splitFullName(fullName);
	const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
	const data = await gh<GhContentsFile | GhContentsFile[]>(
		token,
		`/repos/${owner}/${repo}/contents/${path}${query}`,
	);
	if (Array.isArray(data)) {
		throw new BackendError(400, `"${path}" bir dizin — dosya bekleniyordu.`);
	}
	if (data.encoding === "base64" && typeof data.content === "string") {
		return { path: data.path, sha: data.sha, content: decodeBase64Text(data.content) };
	}
	// İçerik gömülü gelmedi (büyük dosya): blob'tan çek.
	type GhBlob = { content: string; encoding: string };
	const blob = await gh<GhBlob>(token, `/repos/${owner}/${repo}/git/blobs/${data.sha}`);
	if (blob.encoding !== "base64") {
		throw new BackendError(422, `Blob kodlaması desteklenmiyor: ${blob.encoding}`);
	}
	return { path: data.path, sha: data.sha, content: decodeBase64Text(blob.content) };
}

/** Blob'u base64 olarak getirir (taşıma/kopyalama için; içeriği çözmez). */
export async function getBlobBase64(
	token: string,
	fullName: string,
	sha: string,
): Promise<string> {
	const { owner, repo } = splitFullName(fullName);
	type GhBlob = { content: string; encoding: string };
	const blob = await gh<GhBlob>(token, `/repos/${owner}/${repo}/git/blobs/${sha}`);
	if (blob.encoding !== "base64") {
		throw new BackendError(422, `Blob kodlaması desteklenmiyor: ${blob.encoding}`);
	}
	return blob.content.replace(/\n/g, "");
}
