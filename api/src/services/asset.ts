import { ApiError } from "../middleware/error-handler.js";
import { requireProjectAccess } from "./project.js";
import {
  uploadBuffer,
  listFiles,
  deleteFile,
  downloadFile,
} from "./gcs.js";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function gcsPath(projectId: string, filename: string): string {
  return `assets/${projectId}/${filename}`;
}

function proxyUrl(projectId: string, filename: string): string {
  return `/projects/${projectId}/assets/${filename}`;
}

export function sanitizeFilename(raw: string): string {
  const basename = raw.replace(/.*[\\/]/, "");
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized || "unnamed";
}

export function validateAssetFile(
  contentType: string,
  size: number,
  filename: string,
): void {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new ApiError(
      400,
      `Invalid file type "${contentType}". Allowed: png, jpg, gif, svg, webp`,
    );
  }
  if (size > MAX_FILE_SIZE) {
    throw new ApiError(400, `File too large (${size} bytes). Maximum: 5MB`);
  }
  if (!FILENAME_PATTERN.test(filename)) {
    throw new ApiError(400, "Invalid filename. Use alphanumeric, hyphens, underscores, and dots only");
  }
}

export async function uploadAsset(
  userId: string,
  projectId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
) {
  await requireProjectAccess(userId, projectId, "editor");

  const sanitized = sanitizeFilename(filename);
  validateAssetFile(contentType, buffer.length, sanitized);

  const path = gcsPath(projectId, sanitized);
  await uploadBuffer(path, buffer, contentType);

  return {
    url: proxyUrl(projectId, sanitized),
    filename: sanitized,
    contentType,
    size: buffer.length,
  };
}

export async function listAssets(userId: string, projectId: string) {
  await requireProjectAccess(userId, projectId);

  const prefix = `assets/${projectId}/`;
  const files = await listFiles(prefix);

  return files.map((f) => {
    const filename = f.name.replace(prefix, "");
    return {
      filename,
      url: proxyUrl(projectId, filename),
      contentType: f.contentType,
      size: f.size,
      uploadedAt: f.updated,
    };
  });
}

export async function deleteAsset(
  userId: string,
  projectId: string,
  filename: string,
) {
  await requireProjectAccess(userId, projectId, "editor");

  const sanitized = sanitizeFilename(filename);
  const path = gcsPath(projectId, sanitized);
  await deleteFile(path);
}

export async function getAsset(
  userId: string,
  projectId: string,
  filename: string,
) {
  await requireProjectAccess(userId, projectId);

  const sanitized = sanitizeFilename(filename);
  const path = gcsPath(projectId, sanitized);
  return downloadFile(path);
}

export function rewriteAssetUrls(html: string, projectId: string): string {
  return html.replace(
    /(?:src|href)=(["'])assets\/([^"']+)\1/g,
    (match, quote, filename) => {
      const url = proxyUrl(projectId, filename);
      return `${match.split("=")[0]}=${quote}${url}${quote}`;
    },
  );
}
