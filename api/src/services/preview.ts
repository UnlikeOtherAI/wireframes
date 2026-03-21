import fs from "node:fs";
import path from "node:path";
import { ApiError } from "../middleware/error-handler.js";
import { requireProjectAccess } from "./project.js";
import { findDocumentsByProjectId } from "../repositories/document.js";
import { buildDocumentMap } from "./build.js";
import { validateProject, buildProject } from "./engine.js";
import { uploadBuffer } from "./gcs.js";
import {
  findPreviewByProjectId,
  createPreview,
  updatePreviewBuild,
  updatePreviewAccess,
  findPreviewAccessEmails,
  replacePreviewAccessEmails,
  clearPreviewAccessEmails,
} from "../repositories/preview.js";
import type { AccessMode } from "../repositories/preview.js";

const SLUG_LENGTH = 8;
const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LENGTH));
  return Array.from(bytes, (b) => SLUG_CHARS[b % SLUG_CHARS.length]).join("");
}

interface BuildFile {
  path: string;
  content: string | Buffer;
  contentType: string;
}

export function rewritePreviewAssetUrls(html: string, slug: string): string {
  return html
    .replaceAll('src="/assets/', `src="/preview/${slug}/assets/`)
    .replaceAll("src='/assets/", `src='/preview/${slug}/assets/`)
    .replaceAll('href="/assets/', `href="/preview/${slug}/assets/`)
    .replaceAll("href='/assets/", `href='/preview/${slug}/assets/`)
    .replaceAll("url(/assets/", `url(/preview/${slug}/assets/`)
    .replaceAll('src="assets/', `src="/preview/${slug}/assets/`)
    .replaceAll("src='assets/", `src='/preview/${slug}/assets/`)
    .replaceAll('href="assets/', `href="/preview/${slug}/assets/`)
    .replaceAll("href='assets/", `href='/preview/${slug}/assets/`)
    .replaceAll("url(assets/", `url(/preview/${slug}/assets/`);
}

export function assembleBuildFiles(
  buildResult: {
    pages: Array<{
      pageId: string;
      platform: string;
      html: string;
      fileName?: string;
    }>;
    css: string;
    js: string;
    indexHtml: string;
    platformIndexes: Record<string, string>;
  },
  slug: string,
): BuildFile[] {
  const files: BuildFile[] = [];
  const platforms = new Set<string>();

  for (const page of buildResult.pages) {
    platforms.add(page.platform);
    const fileName = page.fileName || `${page.pageId}.html`;
    const rewritten = rewritePreviewAssetUrls(page.html, slug);
    files.push({
      path: `${page.platform}/${fileName}`,
      content: rewritten,
      contentType: "text/html; charset=utf-8",
    });
  }

  for (const platform of platforms) {
    files.push({
      path: `${platform}/_shared/wireframe.css`,
      content: buildResult.css,
      contentType: "text/css; charset=utf-8",
    });
    files.push({
      path: `${platform}/_shared/interactions.js`,
      content: buildResult.js,
      contentType: "application/javascript; charset=utf-8",
    });
  }

  for (const [platform, html] of Object.entries(buildResult.platformIndexes)) {
    const rewritten = rewritePreviewAssetUrls(html, slug);
    files.push({
      path: `${platform}/index.html`,
      content: rewritten,
      contentType: "text/html; charset=utf-8",
    });
  }

  const rewrittenIndex = rewritePreviewAssetUrls(buildResult.indexHtml, slug);
  files.push({
    path: "index.html",
    content: rewrittenIndex,
    contentType: "text/html; charset=utf-8",
  });

  return files;
}

function resolveFontAwesomeDir(): string {
  const resolved = require.resolve(
    "@fortawesome/fontawesome-free/package.json",
  );
  return path.dirname(resolved);
}

export function collectFontAwesomeFiles(): BuildFile[] {
  const files: BuildFile[] = [];
  const faPackageDir = resolveFontAwesomeDir();

  const cssContent = fs
    .readFileSync(path.join(faPackageDir, "css", "all.min.css"), "utf8")
    .replaceAll("font-display:block", "font-display:swap");

  files.push({
    path: "fa/css/all.min.css",
    content: cssContent,
    contentType: "text/css; charset=utf-8",
  });

  const webfontsDir = path.join(faPackageDir, "webfonts");
  for (const file of fs.readdirSync(webfontsDir)) {
    if (file.endsWith(".woff2")) {
      files.push({
        path: `fa/webfonts/${file}`,
        content: fs.readFileSync(path.join(webfontsDir, file)),
        contentType: "font/woff2",
      });
    }
  }

  return files;
}

async function uploadPreviewFiles(
  slug: string,
  buildFiles: BuildFile[],
  faFiles: BuildFile[],
): Promise<void> {
  const platforms = new Set(
    buildFiles
      .filter((f) => f.path.includes("/"))
      .map((f) => f.path.split("/")[0])
      .filter((p) => p !== "index.html"),
  );

  const previewCacheControl = "private, max-age=3600";
  const allFiles: Array<{ gcsPath: string; content: Buffer; contentType: string }> = [];

  for (const file of buildFiles) {
    allFiles.push({
      gcsPath: `previews/${slug}/${file.path}`,
      content: Buffer.from(file.content),
      contentType: file.contentType,
    });
  }

  for (const platform of platforms) {
    for (const faFile of faFiles) {
      allFiles.push({
        gcsPath: `previews/${slug}/${platform}/_shared/${faFile.path}`,
        content: Buffer.from(faFile.content),
        contentType: faFile.contentType,
      });
    }
  }

  await Promise.all(
    allFiles.map((f) => uploadBuffer(f.gcsPath, f.content, f.contentType, previewCacheControl)),
  );
}

export async function publishPreview(userId: string, projectId: string) {
  await requireProjectAccess(userId, projectId, "editor");

  const rows = await findDocumentsByProjectId(projectId);
  if (rows.length === 0) {
    throw new ApiError(422, "Project has no documents to build");
  }

  const documentMap = buildDocumentMap(rows);

  const validation = validateProject(documentMap);
  if (!validation.ok) {
    throw new ApiError(422, "Validation failed", validation.errors);
  }

  const result = buildProject(documentMap, { platform: "all" });
  if (!result.ok) {
    throw new ApiError(422, result.error ?? "Build failed");
  }

  const existing = await findPreviewByProjectId(projectId);
  const slug = existing?.slug ?? generateSlug();
  const buildUrl = `previews/${slug}/`;
  const publishedAt = new Date();

  const buildFiles = assembleBuildFiles(result, slug);
  const faFiles = collectFontAwesomeFiles();
  await uploadPreviewFiles(slug, buildFiles, faFiles);

  let preview;
  if (existing) {
    preview = await updatePreviewBuild(projectId, { buildUrl, publishedAt });
  } else {
    preview = await createPreview({
      projectId,
      slug,
      accessMode: "public",
      buildUrl,
      publishedAt,
    });
  }

  return {
    slug: preview.slug,
    url: `/preview/${preview.slug}`,
    publishedAt: preview.publishedAt,
    accessMode: preview.accessMode,
  };
}

export async function getPreviewSettings(userId: string, projectId: string) {
  const role = await requireProjectAccess(userId, projectId);

  const preview = await findPreviewByProjectId(projectId);
  if (!preview) {
    return null;
  }

  const result: Record<string, unknown> = {
    slug: preview.slug,
    url: preview.buildUrl ? `/preview/${preview.slug}` : null,
    accessMode: preview.accessMode,
    publishedAt: preview.publishedAt,
  };

  if (role === "owner") {
    result.emailAccessList = await findPreviewAccessEmails(preview.id);
  }

  return result;
}

export async function updatePreviewSettings(
  userId: string,
  projectId: string,
  body: { accessMode?: AccessMode; password?: string; emails?: string[] },
) {
  await requireProjectAccess(userId, projectId, "editor");

  let preview = await findPreviewByProjectId(projectId);
  if (!preview) {
    preview = await createPreview({
      projectId,
      slug: generateSlug(),
      accessMode: "public",
      buildUrl: "",
      publishedAt: null,
    });
  }

  if (body.accessMode === "password") {
    if (!body.password) {
      throw new ApiError(400, "Password is required for password access mode");
    }
    const passwordHash = await Bun.password.hash(body.password, {
      algorithm: "bcrypt",
      cost: 12,
    });
    await updatePreviewAccess(projectId, {
      accessMode: "password",
      passwordHash,
    });
    await clearPreviewAccessEmails(preview.id);
  } else if (body.accessMode === "sso") {
    await updatePreviewAccess(projectId, {
      accessMode: "sso",
      passwordHash: null,
    });
    if (body.emails) {
      await replacePreviewAccessEmails(preview.id, body.emails);
    } else {
      await clearPreviewAccessEmails(preview.id);
    }
  } else if (body.accessMode === "public") {
    await updatePreviewAccess(projectId, {
      accessMode: "public",
      passwordHash: null,
    });
    await clearPreviewAccessEmails(preview.id);
  }

  const updated = await findPreviewByProjectId(projectId);
  return {
    slug: updated!.slug,
    url: updated!.buildUrl ? `/preview/${updated!.slug}` : null,
    accessMode: updated!.accessMode,
    publishedAt: updated!.publishedAt,
  };
}
