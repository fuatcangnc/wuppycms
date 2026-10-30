// AWS yayın katmanı — S3 + CloudFront (ADR 0022).
//
// WuppyCMS'in kendi altyapısı: müşteri AWS hesabı açmaz. Her site tek
// bucket'ta `sites/<slug>/` altında durur; tek CloudFront dağıtımı
// `*.sites.wuppycms.com` için hizmet eder.
//
// Neden tek dağıtım + klasör: yeni site = yeni klasör. Yeni dağıtım,
// sertifika, DNS kaydı gerekmez → ölçeklenir, maliyet sabit kalır.
// Yönlendirme CloudFront Function ile `Host` başlığından slug'a çözülür.

import { AwsClient } from "aws4fetch";
import type { AppEnv } from "../../api/types";

const REGION = "us-east-1"; // CloudFront + S3 için imza bölgesi
const SERVICE = "s3";

export type AwsDeployConfig = {
	bucket: string;
	distributionId: string;
	/** `<slug>.` öneki olmadan taban alan adı, ör. sites.wuppycms.com */
	baseDomain: string;
};

export class AwsDeployError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "AwsDeployError";
	}
}

export function awsDeployConfigured(env: AppEnv): boolean {
	return Boolean(
		env.AWS_ACCESS_KEY_ID &&
			env.AWS_SECRET_ACCESS_KEY &&
			env.AWS_S3_BUCKET &&
			env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
	);
}

export function awsDeployConfig(env: AppEnv): AwsDeployConfig {
	if (!awsDeployConfigured(env)) {
		throw new AwsDeployError(
			503,
			"AWS yayın yapılandırılmadı (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_CLOUDFRONT_DISTRIBUTION_ID).",
		);
	}
	return {
		bucket: env.AWS_S3_BUCKET!,
		distributionId: env.AWS_CLOUDFRONT_DISTRIBUTION_ID!,
		baseDomain: env.AWS_SITES_DOMAIN || "sites.wuppycms.com",
	};
}

function client(env: AppEnv): AwsClient {
	return new AwsClient({
		accessKeyId: env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
		service: SERVICE,
		region: REGION,
	});
}

/** Site kimliği → güvenli, çakışmasız klasör adı. */
export function siteSlug(fullName: string): string {
	const base = fullName
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	let hash = 0x811c9dc5;
	for (const char of fullName.toLowerCase()) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `${base}-${hash.toString(36).slice(0, 5).padStart(5, "0")}`;
}

export function siteUrl(env: AppEnv, fullName: string): string {
	const config = awsDeployConfig(env);
	return `https://${siteSlug(fullName)}.${config.baseDomain}`;
}

const CONTENT_TYPES: Record<string, string> = {
	html: "text/html; charset=utf-8",
	css: "text/css; charset=utf-8",
	js: "text/javascript; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	xml: "application/xml; charset=utf-8",
	txt: "text/plain; charset=utf-8",
	svg: "image/svg+xml",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	avif: "image/avif",
	gif: "image/gif",
	ico: "image/x-icon",
	woff: "font/woff",
	woff2: "font/woff2",
	ttf: "font/ttf",
	otf: "font/otf",
	pdf: "application/pdf",
	webmanifest: "application/manifest+json",
	map: "application/json",
};

function contentType(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Uzun ömürlü varlık mı? (hash'li /_astro, font, görsel) */
function isImmutable(path: string): boolean {
	return /^(_astro|fonts|images|assets)\//.test(path) || /\.(woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)$/i.test(path);
}

/** Tek dosyayı S3'e yazar. */
export async function putObject(
	env: AppEnv,
	input: { key: string; body: ArrayBuffer | Uint8Array | string; path: string },
): Promise<void> {
	const config = awsDeployConfig(env);
	const url = `https://${config.bucket}.s3.${REGION}.amazonaws.com/${encodeURIComponent(input.key)
		.replace(/%2F/g, "/")}`;
	const headers: Record<string, string> = {
		"content-type": contentType(input.path),
		"cache-control": isImmutable(input.path)
			? "public, max-age=31536000, immutable"
			: "public, max-age=60, must-revalidate",
	};
	const res = await client(env).fetch(url, {
		method: "PUT",
		headers,
		body: input.body as BodyInit,
	});
	if (!res.ok) {
		const detail = (await res.text().catch(() => "")).slice(0, 300);
		throw new AwsDeployError(res.status, `S3 yükleme hatası (${input.path}): ${detail}`);
	}
}

/** Klasördeki artık dosyaları siler (silinen sayfalar 404 olmasın). */
export async function deleteObject(env: AppEnv, key: string): Promise<void> {
	const config = awsDeployConfig(env);
	const url = `https://${config.bucket}.s3.${REGION}.amazonaws.com/${key.replace(/^\/+/, "")}`;
	const res = await client(env).fetch(url, { method: "DELETE" });
	if (!res.ok && res.status !== 404) {
		throw new AwsDeployError(res.status, `S3 silme hatası: ${key}`);
	}
}

/** CloudFront önbelleğini temizler (deploy sonrası). */
export async function invalidate(env: AppEnv, paths: string[] = ["/*"]): Promise<void> {
	const config = awsDeployConfig(env);
	const url = `https://cloudfront.amazonaws.com/2020-05-31/distribution/${config.distributionId}/invalidation`;
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <Paths>
    <Quantity>${paths.length}</Quantity>
    <Items>${paths.map((path) => `<Path>${path}</Path>`).join("")}</Items>
  </Paths>
  <CallerReference>wuppycms-${Date.now()}</CallerReference>
</InvalidationBatch>`;
	const res = await new AwsClient({
		accessKeyId: env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
		service: "cloudfront",
		region: REGION,
	}).fetch(url, {
		method: "POST",
		headers: { "content-type": "text/xml" },
		body: xml,
	});
	if (!res.ok) {
		const detail = (await res.text().catch(() => "")).slice(0, 300);
		throw new AwsDeployError(res.status, `CloudFront invalidation hatası: ${detail}`);
	}
}

type S3ListEntry = { key: string; size: number };

/** `sites/<slug>/` altındaki mevcut nesneleri listeler (eski dosya temizliği). */
export async function listSiteObjects(env: AppEnv, slug: string): Promise<S3ListEntry[]> {
	const config = awsDeployConfig(env);
	const prefix = `sites/${slug}/`;
	const objects: S3ListEntry[] = [];
	let token: string | undefined;
	for (let page = 0; page < 20; page += 1) {
		const params = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
		if (token) params.set("continuation-token", token);
		const url = `https://${config.bucket}.s3.${REGION}.amazonaws.com/?${params.toString()}`;
		const res = await client(env).fetch(url);
		if (!res.ok) {
			throw new AwsDeployError(res.status, "S3 liste hatası.");
		}
		const xml = await res.text();
		for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
			const block = match[1] ?? "";
			const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1] ?? "";
			const size = Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? "0");
			if (key) objects.push({ key, size });
		}
		if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break;
		token = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
		if (!token) break;
	}
	return objects;
}
