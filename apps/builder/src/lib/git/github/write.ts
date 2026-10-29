// GitHub yazma yolu — atomik çok dosyalı commit (Git Data API):
// blob'lar → ağaç → commit → ref güncellemesi.

import type { CommitAuthor, CommitFile, CommitResult } from "@wuppycms/shared";
import { prepareCommit } from "../commit";
import { gh, splitFullName } from "./api";

type GhRef = { object: { sha: string } };
type GhCommit = { sha: string; tree: { sha: string } };
type GhBlobCreated = { sha: string };
type GhTreeCreated = { sha: string };

/**
 * Dosya değişikliklerini tek commit olarak dalın ucuna ekler.
 * Hazırlanacak dosya kalmazsa `null` döner (boş commit atılmaz).
 */
export async function commitFiles(
	token: string,
	fullName: string,
	branch: string,
	files: CommitFile[],
	message: string,
	author?: CommitAuthor,
	coAuthor?: CommitAuthor,
): Promise<CommitResult | null> {
	const { owner, repo } = splitFullName(fullName);
	const prepared = prepareCommit(files, message, coAuthor);
	if (!prepared) return null;

	// 1) Dalın ucundaki commit ve ağaç.
	const ref = await gh<GhRef>(
		token,
		`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
	);
	const baseSha = ref.object.sha;
	const baseCommit = await gh<GhCommit>(token, `/repos/${owner}/${repo}/git/commits/${baseSha}`);

	// 2) Yazılacak her dosya için blob (paralel).
	const blobShas = await Promise.all(
		prepared.files.map(async (file) => {
			if (file.delete) return null;
			const blob = await gh<GhBlobCreated>(token, `/repos/${owner}/${repo}/git/blobs`, {
				method: "POST",
				body: JSON.stringify({
					content: file.content,
					encoding: file.base64 ? "base64" : "utf-8",
				}),
			});
			return blob.sha;
		}),
	);

	// 3) Ağaç girdileri: silme için sha null, yazma için blob sha.
	const tree = prepared.files.map((file, index) => ({
		path: file.path,
		mode: "100644",
		type: "blob",
		sha: blobShas[index],
	}));

	const newTree = await gh<GhTreeCreated>(token, `/repos/${owner}/${repo}/git/trees`, {
		method: "POST",
		body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
	});

	// 4) Commit ve dal güncellemesi.
	const newCommit = await gh<GhCommit>(token, `/repos/${owner}/${repo}/git/commits`, {
		method: "POST",
		body: JSON.stringify({
			message: prepared.message,
			tree: newTree.sha,
			parents: [baseSha],
			...(author ? { author } : {}),
		}),
	});

	await gh<void>(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
		method: "PATCH",
		body: JSON.stringify({ sha: newCommit.sha, force: false }),
	});

	return {
		sha: newCommit.sha,
		branch,
		message: prepared.message,
		files: prepared.files.map((f) => f.path),
		url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
	};
}
