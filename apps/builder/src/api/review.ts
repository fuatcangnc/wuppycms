// İnceleme akışı (parity 2b-ii) — dal + pull request.
// "İncelemeye gönder": mevcut içerik review/<slug>-<zaman> dalına commit edilir
// ve PR açılır (ana dal DEĞİŞMEZ). İncelemeci onaylar/değişiklik ister;
// birleştirme içeriği ana dala alır — yayın budur (ADR 0006: her şey repo'da).

import { Hono } from "hono";
import {
	closePullRequest,
	commitFiles,
	createBranch,
	createPullRequest,
	getBranch,
	getRepo,
	listPullRequests,
	listReviews,
	mergePullRequest,
	submitReview,
} from "../lib/git";
import type { AppEnv } from "./types";
import { requireUser, resolveGitToken, unauthorized } from "./helpers";
import { body, reviewDecisionSchema, reviewNumberSchema, reviewStartSchema } from "./schemas";

export const review = new Hono<{ Bindings: AppEnv }>();

type ReviewSummary = {
	state: "approved" | "changes_requested" | "commented";
	body: string;
	author: string;
	submittedAt: string;
};

/** PR'ın son kararı (en son inceleme) — liste çipi için. */
function decisionOf(reviews: ReviewSummary[]): "approved" | "changes_requested" | null {
	const last = reviews.at(-1);
	if (!last) return null;
	if (last.state === "approved") return "approved";
	if (last.state === "changes_requested") return "changes_requested";
	return null;
}

// GET /api/review/list?full_name=&state=open — PR'lar + inceleme özetleri.
review.get("/list", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const fullName = c.req.query("full_name") ?? "";
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const state = c.req.query("state") === "all" ? "all" : "open";
	const pulls = await listPullRequests(token, fullName, state);
	const withReviews = await Promise.all(
		pulls.map(async (pull) => {
			const reviews = await listReviews(token, fullName, pull.number);
			return { ...pull, reviews, decision: decisionOf(reviews) };
		}),
	);
	return c.json({ pulls: withReviews });
});

// POST /api/review/start — { full_name, path, content, title?, body? }
review.post("/start", body(reviewStartSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const { full_name: fullName, path } = payload;
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);

	const repo = await getRepo(token, fullName);
	const base = repo.defaultBranch;
	const slug = (path.split("/").pop() ?? path).replace(/\.\w+$/, "");
	const branch = `review/${slug}-${Date.now().toString(36)}`;

	const baseHead = await getBranch(token, fullName, base);
	await createBranch(token, fullName, branch, baseHead.sha);
	await commitFiles(
		token,
		fullName,
		branch,
		[{ path, content: payload.content }],
		`cms: ${slug} incelemeye gönderildi (via WuppyCMS)`,
	);
	const pull = await createPullRequest(token, fullName, {
		title: payload.title || `İnceleme: ${slug}`,
		body: payload.body || `“${path}” için inceleme talebi (WuppyCMS).`,
		head: branch,
		base,
	});
	return c.json({ ok: true, number: pull.number, branch, pull }, 201);
});

// POST /api/review/decision — { full_name, number, event, body? }
review.post("/decision", body(reviewDecisionSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const { full_name: fullName, number, event, body: note } = c.req.valid("json");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	await submitReview(token, fullName, number, event, note ?? "");
	return c.json({ ok: true });
});

// POST /api/review/merge — { full_name, number }
review.post("/merge", body(reviewNumberSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const { full_name: fullName, number } = c.req.valid("json");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const result = await mergePullRequest(token, fullName, number);
	return c.json({ ok: Boolean(result.merged), ...result });
});

// POST /api/review/close — { full_name, number }
review.post("/close", body(reviewNumberSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const { full_name: fullName, number } = c.req.valid("json");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	await closePullRequest(token, fullName, number);
	return c.json({ ok: true });
});
