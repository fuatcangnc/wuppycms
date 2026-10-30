// S3 üzerinde BlobStore adaptörü (R2 arayüzüyle aynı yüzey).

import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type { BlobListEntry, BlobObject, BlobStore } from "./index";

export type S3BlobOptions = {
	bucket: string;
	region?: string;
	/** Kova içi ön ek (ör. "media/"). */
	prefix?: string;
};

export function createS3BlobStore(options: S3BlobOptions): BlobStore {
	const client = new S3Client({ region: options.region ?? "us-east-1" });
	const prefix = options.prefix ?? "";
	const key = (name: string) => `${prefix}${name}`;

	return {
		async get(name: string): Promise<BlobObject | null> {
			try {
				const result = await client.send(
					new GetObjectCommand({ Bucket: options.bucket, Key: key(name) }),
				);
				if (!result.Body) return null;
				return {
					body: result.Body.transformToWebStream() as ReadableStream,
					httpMetadata: { contentType: result.ContentType },
				};
			} catch (error) {
				const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
					?.httpStatusCode;
				const name_ = (error as { name?: string })?.name;
				if (status === 404 || name_ === "NoSuchKey") return null;
				throw error;
			}
		},

		async put(
			name: string,
			value: ArrayBuffer | Uint8Array | ReadableStream,
			opts?: { httpMetadata?: { contentType?: string } },
		): Promise<unknown> {
			return client.send(
				new PutObjectCommand({
					Bucket: options.bucket,
					Key: key(name),
					Body: value as never,
					ContentType: opts?.httpMetadata?.contentType,
				}),
			);
		},

		async delete(name: string): Promise<void> {
			await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key(name) }));
		},

		async list(opts: { prefix?: string; limit?: number; cursor?: string }): Promise<{
			objects: BlobListEntry[];
			truncated: boolean;
			cursor?: string;
		}> {
			const result = await client.send(
				new ListObjectsV2Command({
					Bucket: options.bucket,
					Prefix: key(opts.prefix ?? ""),
					MaxKeys: opts.limit ?? 1000,
					ContinuationToken: opts.cursor,
				}),
			);
			return {
				objects: (result.Contents ?? []).map((item) => ({
					key: (item.Key ?? "").slice(prefix.length),
					size: item.Size ?? 0,
					uploaded: item.LastModified ?? new Date(),
				})),
				truncated: Boolean(result.IsTruncated),
				cursor: result.NextContinuationToken,
			};
		},
	};
}
