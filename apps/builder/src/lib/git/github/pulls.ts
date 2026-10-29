// GitHub inceleme (review/PR) uçları — parity turu 2b-ii. Dal + pull request
// akışı: "İncelemeye gönder" bir review/<slug> dalı açar ve PR yaratır;
// incelemeci onaylar/değişiklik ister; birleştirme içeriği ana dala alır.

import type { PullRequestInfo, ReviewState } from "@wuppycms/shared";
import { gh, splitFullName } from "./api";

type GhPull = {
	number: number;
	title: string;
	body?: string;
	state: string;
	merged?: boolean;
	draft?: boolean;
	head: { ref: string } | string;
	base: { ref: string } | string;
	created_at?: string;
	user?: { login?: string } | null;
};

type GhReview = {
	state: string;
	body?: string;
	user?: { login?: string } | null;
	submitted_at?: string;
};

const refOf = (value: { ref: string } | string): string =>
	typeof value === "string" ? value : value.ref;

function toPullRequestInfo(pull: GhPull): PullRequestInfo {
	return {
		number: pull.number,
		title: pull.title,
		body: pull.body ?? "",
		state: pull.state === "open" ? "open" : "closed",
		merged: Boolean(pull.merged),
		draft: Boolean(pull.draft),
		head: refOf(pull.head),
		base: refOf(pull.base),
		author: pull.user?.login ?? "bilinmiyor",
		createdAt: pull.created_at ?? new Date().toISOString(),
	};
}

/** Dalın ucundaki commit'ten yeni dal açar (varsa hata döner). */
export async function createBranch(
	token: string,
	fullName: string,
	branch: string,
	sha: string,
): Promise<void> {
	const { owner, repo } = splitFullName(fullName);
	await gh(token, `/repos/${owner}/${repo}/git/refs`, {
		method: "POST",
		body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
	});
}

export async function listPullRequests(
	token: string,
	fullName: string,
	state: "open" | "closed" | "all" = "open",
): Promise<PullRequestInfo[]> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhPull[]>(token, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`);
	return data.map(toPullRequestInfo);
}

export async function getPullRequest(
	token: string,
	fullName: string,
	number: number,
): Promise<PullRequestInfo> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhPull>(token, `/repos/${owner}/${repo}/pulls/${number}`);
	return toPullRequestInfo(data);
}

export async function createPullRequest(
	token: string,
	fullName: string,
	input: { title: string; body?: string; head: string; base: string; draft?: boolean },
): Promise<PullRequestInfo> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhPull>(token, `/repos/${owner}/${repo}/pulls`, {
		method: "POST",
		body: JSON.stringify(input),
	});
	return toPullRequestInfo(data);
}

export async function listReviews(
	token: string,
	fullName: string,
	number: number,
): Promise<{ state: ReviewState; body: string; author: string; submittedAt: string }[]> {
	const { owner, repo } = splitFullName(fullName);
	const data = await gh<GhReview[]>(token, `/repos/${owner}/${repo}/pulls/${number}/reviews`);
	return data.map((review) => ({
		state:
			review.state === "APPROVED"
				? "approved"
				: review.state === "CHANGES_REQUESTED"
					? "changes_requested"
					: "commented",
		body: review.body ?? "",
		author: review.user?.login ?? "bilinmiyor",
		submittedAt: review.submitted_at ?? new Date().toISOString(),
	}));
}

export async function submitReview(
	token: string,
	fullName: string,
	number: number,
	event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
	body = "",
): Promise<void> {
	const { owner, repo } = splitFullName(fullName);
	await gh(token, `/repos/${owner}/${repo}/pulls/${number}/reviews`, {
		method: "POST",
		body: JSON.stringify({ event, body }),
	});
}

export async function mergePullRequest(
	token: string,
	fullName: string,
	number: number,
): Promise<{ merged: boolean; sha?: string; message?: string }> {
	const { owner, repo } = splitFullName(fullName);
	return gh(token, `/repos/${owner}/${repo}/pulls/${number}/merge`, {
		method: "PUT",
		body: JSON.stringify({ merge_method: "merge" }),
	});
}

export async function closePullRequest(
	token: string,
	fullName: string,
	number: number,
): Promise<void> {
	const { owner, repo } = splitFullName(fullName);
	await gh(token, `/repos/${owner}/${repo}/pulls/${number}`, {
		method: "PATCH",
		body: JSON.stringify({ state: "closed" }),
	});
}
