// "With AI" site kurulum akışı — proje listesinden açılır. EmDash Build'in
// landing + clarifying questions akışının WuppyCMS/admin tasarımına uyarlaması.
// Site iskeleti /api/build/site ile Astro template repo'sundan üretilir; AI
// brief'i sessionStorage'a bırakılır ve admin ajanı editörde hazırlar.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui-react/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui-react/dropdown-menu";
import { Input } from "@/components/ui-react/input";
import { Skeleton } from "@/components/ui-react/skeleton";
import { Textarea } from "@/components/ui-react/textarea";
import { t } from "@/lib/i18n";

type Step = "template" | "prompt" | "questions" | "design" | "creating";

interface BuildOption {
	label: string;
	description?: string;
	recommended?: boolean;
}

/** Modelin brief'e göre ürettiği soru (EmDash `ask_questions` deseni). */
interface BuildQuestion {
	question: string;
	why?: string;
	options?: BuildOption[];
	allowMultiple?: boolean;
	allowCustom?: boolean;
}

interface Answer {
	selected: string[];
	custom: string;
}

interface BuildResult {
	repoFullName: string;
	branch: string;
}

type SiteTemplate = {
	id: string;
	name: string;
	description: string;
	repo: string;
	preview: string;
	tags: string[];
};

type Installation = {
	installation_id: string;
	account_login: string | null;
	account_type: string | null;
	repository_selection: string | null;
};

const COLORS = [
	{ name: "Wuppy Orange", value: "#dd641e" },
	{ name: "Kumo Blue", value: "#056dff" },
	{ name: "Emerald", value: "#0f9d58" },
	{ name: "Violet", value: "#7c3aed" },
	{ name: "Crimson", value: "#dc2626" },
	{ name: "Ink", value: "#111111" },
];

const EXAMPLES = [
	{ label: t("build.exPortfolio"), prompt: "A minimal photography portfolio for a documentary photographer, with a project gallery, about page and contact." },
	{ label: t("build.exBakery"), prompt: "A warm neighbourhood bakery site with daily menu, story, opening hours and contact details." },
	{ label: t("build.exMagazine"), prompt: "An independent magazine with a strong editorial homepage, issues, essays and a newsletter." },
];

function slugify(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

function answerText(answer: Answer | undefined): string {
	if (!answer) return "";
	const values = [...answer.selected];
	if (answer.custom.trim()) values.push(answer.custom.trim());
	return values.join(", ");
}

export function BuildWithAi({ onClose }: { onClose(): void }) {
	const [step, setStep] = useState<Step>("template");
	const [templates, setTemplates] = useState<SiteTemplate[]>([]);
	const [templateId, setTemplateId] = useState("karakas");
	const [prompt, setPrompt] = useState("");
	const [questions, setQuestions] = useState<BuildQuestion[]>([]);
	const [loadingQuestions, setLoadingQuestions] = useState(false);
	const [questionIndex, setQuestionIndex] = useState(0);
	const answersRef = useRef<Record<number, Answer>>({});
	const currentRef = useRef<Answer>({ selected: [], custom: "" });
	const [answers, setAnswers] = useState<Record<number, Answer>>({});
	const [selected, setSelected] = useState<string[]>([]);
	const [custom, setCustom] = useState("");
	const [siteName, setSiteName] = useState("");
	const [tagline, setTagline] = useState("");
	const [repoName, setRepoName] = useState("");
	const [privateRepo, setPrivateRepo] = useState(false);
	const [color, setColor] = useState(COLORS[0]!.value);
	const [error, setError] = useState("");
	const [creating, setCreating] = useState(false);
	const [installations, setInstallations] = useState<Installation[]>([]);
	const [owner, setOwner] = useState("");

	// Şablon listesi (görselli kartlar) — ilk şablon varsayılan.
	useEffect(() => {
		void (async () => {
			try {
				const res = await fetch("/api/build/templates", { credentials: "same-origin" });
				if (!res.ok) return;
				const data = (await res.json()) as { templates?: SiteTemplate[] };
				const list = data.templates ?? [];
				setTemplates(list);
				setTemplateId((current) =>
					list.some((entry) => entry.id === current) ? current : (list[0]?.id ?? "karakas"),
				);
			} catch {
				// şablon listesi alınamazsa varsayılanla devam
			}
		})();
	}, []);

	// GitHub App kurulumları — site hangi hesapta oluşturulacak? Kişisel hesap
	// için OAuth yolu da var; kurulum varsa varsayılan onun hesabıdır.
	useEffect(() => {
		void (async () => {
			try {
				const res = await fetch("/api/github/app/status", { credentials: "same-origin" });
				if (!res.ok) return;
				const data = (await res.json()) as { installations?: Installation[] };
				const list = data.installations ?? [];
				setInstallations(list);
				setOwner((current) => current || list[0]?.account_login || "");
			} catch {
				// kurulum bilgisi yoksa OAuth yolu denenir
			}
		})();
	}, []);

	const currentQuestion = questions[questionIndex];
	const answered = selected.length > 0 || custom.trim().length > 0;

	/** Cevapları sırayla metne çevirir (sunucu da aynı biçimi kabul eder). */
	const answerList = () =>
		questions.map((question, index) => {
			const answer = answersRef.current[index] ?? { selected: [], custom: "" };
			return {
				question: question.question,
				selected: answer.selected,
				custom: answer.custom,
				answer: answerText(answer),
			};
		});

	const saveCurrent = (value: Answer) => {
		if (!currentQuestion || !questions.length) return;
		answersRef.current = { ...answersRef.current, [questionIndex]: value };
		setAnswers(answersRef.current);
	};

	const loadQuestion = (index: number) => {
		const answer = answersRef.current[index];
		currentRef.current = {
			selected: answer?.selected ?? [],
			custom: answer?.custom ?? "",
		};
		setQuestionIndex(index);
		setSelected(currentRef.current.selected);
		setCustom(currentRef.current.custom);
	};

	const chooseOption = (value: string) => {
		if (!currentQuestion) return;
		if (currentQuestion.allowMultiple) {
			const next = selected.includes(value)
				? selected.filter((item) => item !== value)
				: [...selected, value];
			setSelected(next);
			currentRef.current = { selected: next, custom: currentRef.current.custom };
		} else {
			setSelected([value]);
			setCustom("");
			currentRef.current = { selected: [value], custom: "" };
		}
	};

	const goNext = () => {
		if (!currentQuestion) return;
		saveCurrent(currentRef.current);
		if (questionIndex >= questions.length - 1) {
			finishQuestions();
			return;
		}
		loadQuestion(questionIndex + 1);
	};

	const goBack = () => {
		if (questionIndex === 0) {
			setStep("prompt");
			return;
		}
		saveCurrent(currentRef.current);
		loadQuestion(questionIndex - 1);
	};

	const skip = () => {
		currentRef.current = { selected: [], custom: "" };
		setSelected([]);
		setCustom("");
		saveCurrent(currentRef.current);
		if (questionIndex >= questions.length - 1) {
			finishQuestions();
			return;
		}
		loadQuestion(questionIndex + 1);
	};

	/** Cevaplardan site adı/etiket önerisi çıkarır ve tasarım adımına geçer. */
	const finishQuestions = () => {
		const saved = answersRef.current;
		const customName = questions
			.map((question, index) => ({ question, answer: saved[index] }))
			.find(
				({ question, answer }) =>
					answer?.custom.trim() &&
					(/adı|name|isim/i.test(question.question) || !question.options?.length),
			);
		const chosen = questions.flatMap((question, index) =>
			(saved[index]?.selected ?? []).map((value) => `${question.question}||${value}`),
		);
		const name =
			customName?.answer?.custom.trim() ||
			chosen.find((entry) => /adı|name|isim/i.test(entry.split("||")[0] ?? ""))?.split("||")[1] ||
			siteName;
		const tone = chosen.find((entry) => /ton|feel|stil|tarz|görün/i.test(entry.split("||")[0] ?? ""));
		setSiteName((value) => value || name || "");
		setTagline(
			(value) => value || tone?.split("||")[1] || `${templateId === "karakas" ? "Kurumsal" : "Sade"} · WuppyCMS`,
		);
		setStep("design");
	};

	/** Brief'i gönderip işe özel soruları getirir. */
	const loadQuestions = () => {
		if (prompt.trim().length < 10 || loadingQuestions) return;
		setLoadingQuestions(true);
		setError("");
		void (async () => {
			try {
				const res = await fetch("/api/build/questions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ prompt, template: templateId, siteName: siteName || undefined }),
				});
				const data = (await res.json().catch(() => ({}))) as {
					questions?: BuildQuestion[];
					reason?: string;
				};
				const list = data.questions ?? [];
				setQuestions(list);
				setQuestionIndex(0);
				answersRef.current = {};
				currentRef.current = { selected: [], custom: "" };
				setSelected([]);
				setCustom("");
				setStep("questions");
			} catch (err) {
				setError(err instanceof Error ? err.message : t("build.error"));
			} finally {
				setLoadingQuestions(false);
			}
		})();
	};

	const createSite = () => {
		if (creating) return;
		const name = siteName.trim();
		const slug = slugify(repoName.trim() || name) || "my-site";
		if (!name) {
			setError(t("build.siteName"));
			return;
		}
		setCreating(true);
		setError("");
		setStep("creating");
		const answerPairs = answerList().filter(
			(entry) => entry.selected.length > 0 || entry.custom.trim().length > 0,
		);
		void (async () => {
			try {
				const res = await fetch("/api/build/site", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({
						prompt,
						siteName: name,
						tagline: tagline.trim() || "A site built with WuppyCMS",
						repoName: slug,
						template: templateId,
						owner: owner || undefined,
						private: privateRepo,
						color,
						answers: answerPairs,
					}),
				});
				const data = (await res.json().catch(() => ({}))) as BuildResult & { message?: string };
				if (!res.ok) throw new Error(data.message ?? t("build.error"));
				sessionStorage.setItem(
					"wuppycms:build:brief",
					JSON.stringify({
						prompt,
						siteName: name,
						tagline,
						color,
						answers: answerPairs,
					}),
				);
				window.location.assign(`/admin?site=${encodeURIComponent(data.repoFullName)}&build=1`);
			} catch (err) {
				setCreating(false);
				setStep("design");
				setError(err instanceof Error ? err.message : t("build.error"));
			}
		})();
	};

	const defaultTagline = questions.length
		? Object.values(answersRef.current)
				.flatMap((answer) => answer.selected)
				.slice(0, 2)
				.join(" · ")
		: "";

	return (
		<main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
			<div className="mb-6 flex items-center justify-between gap-3">
				<Button type="button" variant="ghost" size="sm" onClick={onClose}>
					← {t("build.backToProjects")}
				</Button>
				<span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
					{t("build.kicker")}
				</span>
			</div>

			{step === "template" ? (
				<section className="rounded-2xl border border-border bg-card p-5 shadow-lg">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("build.templateKicker")}</p>
							<h2 className="mt-1 text-lg font-semibold">{t("build.templateTitle")}</h2>
							<p className="mt-1 text-sm text-muted-foreground">{t("build.templateSubtitle")}</p>
						</div>
						<span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">
							{templateId}
						</span>
					</div>

					<div className="mt-5 grid gap-3 sm:grid-cols-2">
						{templates.length === 0
							? [0, 1].map((index) => (
									<div key={index} className="overflow-hidden rounded-xl border border-border">
										<Skeleton className="aspect-[16/10] w-full" />
										<div className="space-y-2 p-4">
											<Skeleton className="h-4 w-2/3" />
											<Skeleton className="h-3 w-full" />
											<Skeleton className="h-3 w-4/5" />
										</div>
									</div>
								))
							: templates.map((entry) => {
									const active = entry.id === templateId;
									return (
										<button
											key={entry.id}
											type="button"
											onClick={() => setTemplateId(entry.id)}
											aria-pressed={active}
											className={`group overflow-hidden rounded-xl border text-left transition-colors ${
												active
													? "border-primary ring-2 ring-primary/30"
													: "border-border hover:border-primary/50"
											}`}
										>
											<div className="relative aspect-[16/10] overflow-hidden bg-muted">
												<img
													src={entry.preview}
													alt={`${entry.name} şablon önizlemesi`}
													className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
													loading="lazy"
												/>
												{active ? (
													<span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
														{t("build.templateSelected")}
													</span>
												) : null}
											</div>
											<div className="p-4">
												<h3 className="text-sm font-semibold">{entry.name}</h3>
												<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
													{entry.description}
												</p>
												<div className="mt-2 flex flex-wrap gap-1">
													{entry.tags.map((tag) => (
														<span
															key={tag}
															className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
														>
															{tag}
														</span>
													))}
												</div>
											</div>
										</button>
									);
								})}
					</div>

					<div className="mt-5 flex justify-end border-t border-border pt-4">
						<Button type="button" onClick={() => setStep("prompt")}>
							{t("build.templateContinue")} →
						</Button>
					</div>
				</section>
			) : null}

			{step === "prompt" ? (
				<section className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-xl sm:px-12">
					<div
						className="pointer-events-none absolute inset-x-0 bottom-0 h-72 opacity-70"
						style={{
							background:
								"radial-gradient(ellipse at 50% 100%, rgba(221,100,30,.38), rgba(124,58,237,.14) 45%, transparent 72%)",
						}}
						aria-hidden="true"
					/>
					<div className="relative">
						<p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("build.kicker")}</p>
						<h1 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
							{t("build.title")}
						</h1>
						<p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
							{t("build.subtitle")}
						</p>
						<div className="mx-auto mt-8 max-w-2xl text-left">
							<Textarea
								rows={5}
								autoFocus
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
								placeholder={t("build.placeholder")}
								className="min-h-36 resize-y bg-background/70 text-base"
								onKeyDown={(event) => {
									if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && prompt.trim().length >= 10) {
										loadQuestions();
									}
								}}
							/>
							<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
								<span className="text-[11px] text-muted-foreground">{t("build.examples")}</span>
								<Button
									type="button"
									disabled={prompt.trim().length < 10 || loadingQuestions}
									onClick={loadQuestions}
								>
									{loadingQuestions ? t("build.analysing") : t("build.continue")} →
								</Button>
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								{EXAMPLES.map((example) => (
									<button
										key={example.label}
										type="button"
										onClick={() => setPrompt(example.prompt)}
										className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
									>
										{example.label}
									</button>
								))}
							</div>
						</div>
					</div>
				</section>
			) : null}

			{step === "questions" && !currentQuestion ? (
				<section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
					<h2 className="text-lg font-semibold">{t("build.noQuestionsTitle")}</h2>
					<p className="mt-1 text-sm text-muted-foreground">{t("build.noQuestionsBody")}</p>
					<div className="mt-5 flex justify-end gap-2">
						<Button type="button" variant="ghost" size="sm" onClick={() => setStep("prompt")}>
							← {t("build.back")}
						</Button>
						<Button type="button" onClick={() => setStep("design")}>
							{t("build.continue")} →
						</Button>
					</div>
				</section>
			) : null}

			{step === "questions" && currentQuestion ? (
				<section className="rounded-2xl border border-border bg-card p-5 shadow-lg">
					<div className="flex items-start gap-3">
						<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm text-primary">?</span>
						<div className="min-w-0 flex-1">
							<h2 className="text-sm font-semibold">{t("build.questionsTitle")}</h2>
							<p className="mt-0.5 text-xs text-muted-foreground">{t("build.questionsSubtitle")}</p>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="tabular-nums">{questionIndex + 1}/{questions.length}</span>
							<button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent" aria-label={t("build.close")}>
								✕
							</button>
						</div>
					</div>

					<div className="mt-3 flex gap-1" aria-hidden="true">
						{questions.map((_, index) => (
							<span
								key={index}
								className={`h-1 flex-1 rounded-full ${index < questionIndex ? "bg-primary" : index === questionIndex ? "bg-primary/60" : "bg-muted"}`}
							/>
						))}
					</div>

					<div className="mt-6">
						<h3 className="text-base font-medium">{currentQuestion.question}</h3>
						<p className="mt-1 text-xs text-muted-foreground">{currentQuestion.why}</p>
						{currentQuestion.options ? (
							<div className="mt-4 grid gap-2">
								{currentQuestion.options.map((option) => {
									const active = selected.includes(option.label);
									return (
										<button
											key={option.label}
											type="button"
											onClick={() => chooseOption(option.label)}
											aria-pressed={active}
											className={`flex min-h-11 items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
												active
													? "border-primary bg-primary/10 text-foreground"
													: "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
											}`}
										>
											<span className="min-w-0">
												<span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
													{option.label}
													{option.recommended ? (
														<span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
															{t("build.recommended")}
														</span>
													) : null}
												</span>
												{option.description ? (
													<span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
														{option.description}
													</span>
												) : null}
											</span>
											<span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
												{active ? "✓" : ""}
											</span>
										</button>
									);
								})}
							</div>
						) : null}
						<Input
							className="mt-3"
							value={custom}
							onChange={(event) => {
								const value = event.target.value;
								setCustom(value);
								currentRef.current = {
									selected: value.trim() ? [] : currentRef.current.selected,
									custom: value,
								};
								if (value.trim()) setSelected([]);
							}}
							placeholder={currentQuestion.options ? t("build.q.customOr") : t("build.q.custom")}
						/>
					</div>

					<div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
						<Button type="button" variant="ghost" size="sm" onClick={goBack} disabled={questionIndex === 0}>
							← {t("build.back")}
						</Button>
						<div className="flex items-center gap-2">
							<Button type="button" variant="outline" size="sm" onClick={skip}>
								{questionIndex === questions.length - 1 ? `${t("build.skip")} & ${t("build.submit")}` : t("build.skip")}
							</Button>
							<Button type="button" size="sm" onClick={goNext} disabled={!answered}>
								{questionIndex === questions.length - 1 ? t("build.submit") : t("build.next")} →
							</Button>
						</div>
					</div>
				</section>
			) : null}

			{step === "design" ? (
				<section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
					<h2 className="text-lg font-semibold">{t("build.designTitle")}</h2>
					<p className="mt-1 text-sm text-muted-foreground">{t("build.designSubtitle")}</p>
					<div className="mt-6 grid gap-4 sm:grid-cols-2">
						<label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
							{t("build.siteName")}
							<Input value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="Acme Studio" />
						</label>
						<label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
							{t("build.tagline")}
							<Input value={tagline} onChange={(event) => setTagline(event.target.value)} placeholder={defaultTagline || "A site built with WuppyCMS"} />
						</label>
						<label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
							{t("build.repoName")}
							<Input
								value={repoName}
								onChange={(event) => setRepoName(event.target.value)}
								placeholder={slugify(siteName) || "my-site"}
							/>
						</label>
						<label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
							<input type="checkbox" checked={privateRepo} onChange={(event) => setPrivateRepo(event.target.checked)} />
							{t("build.private")}
						</label>
					</div>

					<div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
						<span className="text-xs font-medium text-muted-foreground">{t("build.owner")}</span>
						{installations.length > 1 ? (
							<DropdownMenu>
								<DropdownMenuTrigger variant="outline" size="sm">
									@{owner || installations[0]?.account_login}
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuLabel>{t("build.ownerHint")}</DropdownMenuLabel>
									{installations.map((entry) => (
										<DropdownMenuItem
											key={entry.installation_id}
											onSelect={() => setOwner(entry.account_login ?? "")}
										>
											<span className="truncate">@{entry.account_login}</span>
											<span className="ml-auto text-xs text-muted-foreground">
												{entry.account_type === "Organization"
													? t("project.app.organization")
													: t("project.app.personal")}
											</span>
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						) : installations.length === 1 ? (
							<span className="text-sm font-medium">@{owner}</span>
						) : (
							<span className="text-xs text-muted-foreground">{t("build.ownerOauth")}</span>
						)}
					</div>

					<div className="mt-6">
						<p className="text-xs font-medium text-muted-foreground">{t("build.color")}</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{COLORS.map((entry) => (
								<button
									key={entry.value}
									type="button"
									onClick={() => setColor(entry.value)}
									aria-label={`${entry.name} ${entry.value}`}
									aria-pressed={color === entry.value}
									className={`flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] transition-colors ${
										color === entry.value ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"
									}`}
								>
									<span className="size-5 rounded-full border border-black/10" style={{ background: entry.value }} />
									{entry.name}
								</button>
							))}
						</div>
					</div>

					{error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
					<div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
						<Button type="button" variant="ghost" size="sm" onClick={() => setStep("questions")}>
							← {t("build.back")}
						</Button>
						<Button type="button" onClick={createSite} disabled={!siteName.trim() || creating}>
							{t("build.create")} →
						</Button>
					</div>
				</section>
			) : null}

			{step === "creating" ? (
				<section className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
					<div className="border-b border-border px-5 py-4">
						<h2 className="text-lg font-semibold">{t("build.creating")}</h2>
						<p className="mt-1 text-sm text-muted-foreground">{t("build.creatingHint")}</p>
					</div>
					{/* Bejamas Skeleton — site iskeleti oluşturulurken boş ekran yerine */}
					<div className="space-y-5 p-5" aria-busy="true" aria-live="polite">
						<div className="flex items-center justify-between gap-4">
							<Skeleton className="h-7 w-40" />
							<div className="hidden gap-2 sm:flex">
								<Skeleton className="h-7 w-16" />
								<Skeleton className="h-7 w-16" />
								<Skeleton className="h-7 w-16" />
							</div>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-3">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-4/5" />
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-3/4" />
								<div className="flex gap-2 pt-2">
									<Skeleton className="h-9 w-32" />
									<Skeleton className="h-9 w-28" />
								</div>
							</div>
							<Skeleton className="aspect-[4/3] w-full rounded-xl" />
						</div>
						<div className="grid gap-3 sm:grid-cols-3">
							{[0, 1, 2].map((index) => (
								<div key={index} className="space-y-2 rounded-xl border border-border p-3">
									<Skeleton className="h-24 w-full rounded-lg" />
									<Skeleton className="h-4 w-2/3" />
									<Skeleton className="h-3 w-full" />
									<Skeleton className="h-3 w-4/5" />
								</div>
							))}
						</div>
					</div>
				</section>
			) : null}
		</main>
	);
}
