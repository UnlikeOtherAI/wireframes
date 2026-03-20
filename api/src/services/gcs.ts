import { Storage } from "@google-cloud/storage";
import { config } from "../config.js";

let storageInstance: Storage | null = null;

function getStorage(): Storage {
  if (!storageInstance) {
    const options: ConstructorParameters<typeof Storage>[0] = {};
    if (config.gcsServiceAccountKey) {
      options.keyFilename = config.gcsServiceAccountKey;
    }
    storageInstance = new Storage(options);
  }
  return storageInstance;
}

function getBucket() {
  if (!config.gcsBucket) {
    throw new Error("GCS_BUCKET environment variable is not configured");
  }
  return getStorage().bucket(config.gcsBucket);
}

export async function uploadBuffer(
  filePath: string,
  buffer: Buffer,
  contentType: string,
  cacheControl: string = "private, max-age=31536000",
): Promise<void> {
  const bucket = getBucket();
  const file = bucket.file(filePath);
  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl,
    },
  });
}

export interface GcsFileInfo {
  name: string;
  contentType: string;
  size: number;
  updated: string;
}

export async function listFiles(prefix: string): Promise<GcsFileInfo[]> {
  const bucket = getBucket();
  const [files] = await bucket.getFiles({ prefix });
  return files.map((f) => ({
    name: f.name,
    contentType: (f.metadata.contentType as string) || "application/octet-stream",
    size: Number(f.metadata.size) || 0,
    updated: (f.metadata.updated as string) || "",
  }));
}

export async function deleteFile(filePath: string): Promise<void> {
  const bucket = getBucket();
  await bucket.file(filePath).delete();
}

export interface GcsDownloadResult {
  buffer: Buffer;
  contentType: string;
}

export async function downloadFile(filePath: string): Promise<GcsDownloadResult> {
  const bucket = getBucket();
  const file = bucket.file(filePath);
  const [contents] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    buffer: Buffer.from(contents),
    contentType: (metadata.contentType as string) || "application/octet-stream",
  };
}
