// GitHub sağlayıcısı — BackendService sözleşmesinin uygulaması.

import type { BackendService } from "../backend";
import { listBranches, getBranch } from "./branches";
import { compareCommits, listCommits } from "./commits";
import { getBlobBase64, getFile } from "./files";
import {
	closePullRequest,
	createBranch,
	createPullRequest,
	getPullRequest,
	listPullRequests,
	listReviews,
	mergePullRequest,
	submitReview,
} from "./pulls";
import { getRepo, listUserRepos } from "./repo";
import { listTree } from "./tree";
import { commitFiles } from "./write";

export const githubBackend: BackendService = {
	name: "github",
	label: "GitHub",
	isGit: true,
	getRepo,
	listUserRepos,
	getBranch,
	listBranches,
	listTree,
	getFile,
	getBlobBase64,
	compareCommits,
	listCommits,
	commitFiles,
	// İnceleme akışı (parity 2b-ii)
	createBranch,
	listPullRequests,
	getPullRequest,
	createPullRequest,
	listReviews,
	submitReview,
	mergePullRequest,
	closePullRequest,
};
