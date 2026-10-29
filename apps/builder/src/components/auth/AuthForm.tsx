// Giriş/kayıt formu adası — better-auth uçlarını fetch'le çağırır.
// /login (mode="sign-in") ve /signup (mode="sign-up") aynı bileşeni kullanır.

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { t } from "@/lib/i18n";

const ERROR_KEYS: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "auth.errBadCredentials",
	USER_ALREADY_EXISTS: "auth.errUserExists",
	EMAIL_ALREADY_IN_USE: "auth.errEmailInUse",
	PASSWORD_TOO_SHORT: "auth.errPasswordShort",
	TOO_MANY_REQUESTS: "auth.errTooMany",
};

export default function AuthForm({
	mode,
	next,
}: {
	mode: "sign-in" | "sign-up";
	next: string;
}) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const payload: Record<string, string> = { email, password, callbackURL: next };
			if (mode === "sign-up") payload.name = name;
			const res = await fetch(`/api/auth/${mode}/email`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(payload),
			});
			const data = (await res.json().catch(() => ({}))) as {
				success?: boolean;
				message?: string;
				code?: string;
			};
			if (res.ok && data.success !== false) {
				window.location.assign(next);
				return;
			}
			setError(
				(data.code && ERROR_KEYS[data.code] && t(ERROR_KEYS[data.code])) ||
					data.message ||
					t("auth.requestFailed"),
			);
		} catch {
			setError(t("auth.serverUnreachable"));
		} finally {
			setBusy(false);
		}
	};

	const githubSignIn = async () => {
		setError("");
		try {
			const res = await fetch("/api/auth/sign-in/social", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ provider: "github", callbackURL: next }),
			});
			const data = (await res.json().catch(() => ({}))) as { url?: string };
			if (data.url) {
				window.location.assign(data.url);
				return;
			}
			setError(t("auth.githubFailed"));
		} catch {
			setError(t("auth.serverUnreachable"));
		}
	};

	return (
		<>
			<form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-3">
				{mode === "sign-up" && (
					<label className="grid gap-1.5 text-sm">
						{t("auth.fullName")}
						<Input required autoComplete="name" placeholder={t("auth.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
					</label>
				)}
				<label className="grid gap-1.5 text-sm">
					{t("auth.email")}
					<Input type="email" required autoComplete="email" placeholder="ornek@site.com" value={email} onChange={(e) => setEmail(e.target.value)} />
				</label>
				<label className="grid gap-1.5 text-sm">
					{t("auth.password")}
					<Input
						type="password"
						required
						autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
						minLength={mode === "sign-up" ? 8 : undefined}
						placeholder={mode === "sign-up" ? t("auth.passwordMin") : "••••••••"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</label>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<Button type="submit" disabled={busy} className="mt-1 w-full">
					{mode === "sign-up" ? t("auth.signUp") : t("auth.signIn")}
				</Button>
			</form>

			<div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
				<span className="h-px flex-1 bg-border"></span>
				{t("auth.or")}
				<span className="h-px flex-1 bg-border"></span>
			</div>

			<Button variant="outline" className="w-full" disabled={busy} onClick={() => void githubSignIn()}>
				{t("auth.github")}
			</Button>
		</>
	);
}
