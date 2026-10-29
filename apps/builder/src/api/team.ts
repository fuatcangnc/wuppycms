// Ekip / izinler (parity 2b) — proje paylaşımı. Sahip davet üretir; davet
// bağlantısı paylaşılır (e-posta gönderimi yok); üye kendi hesabıyla kabul
// eder. Üyeler KENDİ GitHub bağlantılarıyla çalışır — sahibin token'ı
// paylaşılmaz (güvenlik kararı).

import { Hono } from "hono";
import type { SqlDatabase } from "../lib/platform";
import type { AppEnv } from "./types";
import { platform, requireUser } from "./helpers";
import { body, teamAcceptSchema, teamInviteSchema, teamRemoveSchema, teamRevokeSchema } from "./schemas";

export const team = new Hono<{ Bindings: AppEnv }>();

type MemberRow = {
	user_id: string;
	role: string;
	created_at: string;
	name: string | null;
	email: string | null;
};

type InvitationRow = {
	id: string;
	email: string;
	role: string;
	token: string;
	created_at: string;
	accepted_at: string | null;
};

/** Kullanıcının projedeki rolü: 'owner' | 'editor' | 'viewer' | null.
 *  Platform arayüzü (ADR 0006) üzerinden çalışır — D1 yalnız referans adaptör. */
export async function projectRole(
	db: SqlDatabase,
	userId: string,
	projectId: string,
): Promise<"owner" | "editor" | "viewer" | null> {
	const owner = await db
		.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
		.bind(projectId, userId)
		.first<{ id: string }>();
	if (owner) return "owner";
	const member = await db
		.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
		.bind(projectId, userId)
		.first<{ role: string }>();
	if (!member) return null;
	return member.role === "viewer" ? "viewer" : "editor";
}

// GET /api/team/members?project_id= — üyeler + bekleyen davetler.
team.get("/members", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const projectId = c.req.query("project_id") ?? "";
	if (!projectId || !db) return c.json({ error: "invalid" }, 400);
	const role = await projectRole(db, user.id, projectId);
	if (!role) return c.json({ error: "forbidden", message: "Bu projeye erişiminiz yok." }, 403);

	const { results: members } = await db.prepare(
		`SELECT m.user_id, m.role, m.created_at, u.name, u.email
		 FROM project_members m LEFT JOIN user u ON u.id = m.user_id
		 WHERE m.project_id = ? ORDER BY m.created_at ASC`,
	)
		.bind(projectId)
		.all<MemberRow>();
	const { results: invitations } = await db.prepare(
		`SELECT id, email, role, token, created_at, accepted_at FROM project_invitations
		 WHERE project_id = ? AND accepted_at IS NULL ORDER BY created_at DESC`,
	)
		.bind(projectId)
		.all<InvitationRow>();
	const owner = await db.prepare(
		`SELECT u.name, u.email FROM projects p LEFT JOIN user u ON u.id = p.user_id WHERE p.id = ?`,
	)
		.bind(projectId)
		.first<{ name: string | null; email: string | null }>();

	return c.json({
		role,
		owner: { name: owner?.name ?? "", email: owner?.email ?? "" },
		members: (members ?? []).map((row) => ({
			userId: row.user_id,
			role: row.role,
			name: row.name ?? "",
			email: row.email ?? "",
			joinedAt: row.created_at,
		})),
		invitations: (invitations ?? []).map((row) => ({
			id: row.id,
			email: row.email,
			role: row.role,
			createdAt: row.created_at,
			invitePath: `/invite?token=${row.token}`,
		})),
	});
});

// POST /api/team/invite — { project_id, email, role } (yalnız sahip).
team.post("/invite", body(teamInviteSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const payload = c.req.valid("json");
	const projectId = payload.project_id;
	const email = payload.email;
	const role = payload.role ?? "editor";
	if (!db) return c.json({ error: "not_configured" }, 503);
	if ((await projectRole(db, user.id, projectId)) !== "owner") {
		return c.json({ error: "forbidden", message: "Yalnız proje sahibi davet edebilir." }, 403);
	}

	const token = crypto.randomUUID();
	const id = crypto.randomUUID();
	await db.prepare(
		"INSERT INTO project_invitations (id, project_id, email, role, token, invited_by) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(id, projectId, email, role, token, user.id)
		.run();
	return c.json({ ok: true, id, email, role, invitePath: `/invite?token=${token}` }, 201);
});

// POST /api/team/accept — { token }: giriş yapan kullanıcı daveti kabul eder.
team.post("/accept", body(teamAcceptSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const { token } = c.req.valid("json");
	if (!db) return c.json({ error: "not_configured" }, 503);

	const invitation = await db.prepare(
		"SELECT id, project_id, email, role FROM project_invitations WHERE token = ? AND accepted_at IS NULL",
	)
		.bind(token)
		.first<{ id: string; project_id: string; email: string; role: string }>();
	if (!invitation) return c.json({ error: "not_found", message: "Davet bulunamadı ya da kullanılmış." }, 404);
	if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
		return c.json(
			{ error: "email_mismatch", message: `Bu davet “${invitation.email}” için — o hesapla giriş yapın.` },
			403,
		);
	}
	await db.batch([
		db.prepare(
			"INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
		).bind(invitation.project_id, user.id, invitation.role),
		db.prepare("UPDATE project_invitations SET accepted_at = datetime('now') WHERE id = ?").bind(
			invitation.id,
		),
	]);
	const project = await db.prepare("SELECT id, name, repo_full_name, default_branch FROM projects WHERE id = ?")
		.bind(invitation.project_id)
		.first<{ id: string; name: string; repo_full_name: string; default_branch: string }>();
	return c.json({
		ok: true,
		project: project
			? { id: project.id, name: project.name, repoFullName: project.repo_full_name, branch: project.default_branch }
			: null,
		role: invitation.role,
	});
});

// DELETE /api/team/members — { project_id, user_id } (yalnız sahip).
team.delete("/members", body(teamRemoveSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const { project_id: projectId, user_id: userId } = c.req.valid("json");
	if (!db) return c.json({ error: "not_configured" }, 503);
	if ((await projectRole(db, user.id, projectId)) !== "owner") {
		return c.json({ error: "forbidden", message: "Yalnız proje sahibi üye çıkarabilir." }, 403);
	}
	await db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?")
		.bind(projectId, userId)
		.run();
	return c.json({ ok: true });
});

// DELETE /api/team/invitations — { project_id, invitation_id } (yalnız sahip).
team.delete("/invitations", body(teamRevokeSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const { project_id: projectId, invitation_id: invitationId } = c.req.valid("json");
	if (!db) return c.json({ error: "not_configured" }, 503);
	if ((await projectRole(db, user.id, projectId)) !== "owner") {
		return c.json({ error: "forbidden", message: "Yalnız proje sahibi daveti iptal edebilir." }, 403);
	}
	await db.prepare("DELETE FROM project_invitations WHERE id = ? AND project_id = ?")
		.bind(invitationId, projectId)
		.run();
	return c.json({ ok: true });
});
