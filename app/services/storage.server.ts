import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageWriteInput = {
  shopDomain: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
};

export type StorageWriteResult = {
  storageKey: string;
  publicUrl: string | null;
};

export type StorageReadResult = {
  body: Buffer;
  contentType: string;
};

export interface StorageService {
  write(input: StorageWriteInput): Promise<StorageWriteResult>;
  read(storageKey: string): Promise<StorageReadResult>;
  deleteShopData(shopDomain: string): Promise<void>;
  getSignedDownloadUrl?(storageKey: string): Promise<string>;
}

export class LocalStorageService implements StorageService {
  constructor(private readonly rootDir = process.env.LOCAL_STORAGE_DIR ?? "./storage") {}

  async write(input: StorageWriteInput): Promise<StorageWriteResult> {
    const shopDomain = sanitizePathSegment(input.shopDomain);
    const relativeKey = sanitizeStorageKey(input.key);
    const storageKey = `${shopDomain}/${relativeKey}`;
    const targetPath = this.resolve(storageKey);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(input.body));
    await writeFile(`${targetPath}.content-type`, input.contentType);
    return { storageKey, publicUrl: null };
  }

  async read(storageKey: string): Promise<StorageReadResult> {
    const targetPath = this.resolve(storageKey);
    const [body, contentType] = await Promise.all([
      readFile(targetPath),
      readFile(`${targetPath}.content-type`, "utf8").catch(() => "application/octet-stream"),
    ]);
    return { body, contentType };
  }

  async deleteShopData(shopDomain: string): Promise<void> {
    const targetPath = this.resolve(sanitizePathSegment(shopDomain));
    await rm(targetPath, { recursive: true, force: true });
  }

  private resolve(storageKey: string): string {
    const normalized = sanitizeStorageKey(storageKey);
    const root = path.resolve(this.rootDir);
    const target = path.resolve(root, normalized);
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Invalid storage key.");
    }
    return target;
  }
}

export class S3CompatibleStorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor() {
    this.bucket = requireEnv("S3_BUCKET");
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
      },
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    });
  }

  async write(input: StorageWriteInput): Promise<StorageWriteResult> {
    const storageKey = `${sanitizePathSegment(input.shopDomain)}/${sanitizeStorageKey(input.key)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: Buffer.from(input.body),
        ContentType: input.contentType,
      }),
    );
    return {
      storageKey,
      publicUrl: this.publicBaseUrl ? `${this.publicBaseUrl}/${storageKey}` : null,
    };
  }

  async read(storageKey: string): Promise<StorageReadResult> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: sanitizeStorageKey(storageKey) }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return {
      body: Buffer.concat(chunks),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  }

  async getSignedDownloadUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: sanitizeStorageKey(storageKey) }),
      { expiresIn: 60 },
    );
  }

  async deleteShopData(shopDomain: string): Promise<void> {
    const prefix = `${sanitizePathSegment(shopDomain)}/`;
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      const objects =
        listed.Contents?.map((object) => object.Key)
          .filter((key): key is string => Boolean(key))
          .map((Key) => ({ Key })) ?? [];

      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects },
          }),
        );
      }

      continuationToken = listed.NextContinuationToken;
    } while (continuationToken);
  }
}

export function getStorageService(): StorageService {
  return process.env.STORAGE_DRIVER === "s3"
    ? new S3CompatibleStorageService()
    : new LocalStorageService();
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9.-]/g, "_");
}

function sanitizeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) throw new Error("Invalid storage key.");
  return normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment))
    .join("/");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
