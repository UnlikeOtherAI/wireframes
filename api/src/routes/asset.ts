import {
  uploadAssetController,
  listAssetsController,
  deleteAssetController,
} from "../controllers/asset.js";

const ASSETS_PATTERN = /^\/projects\/([0-9a-f-]{36})\/assets$/;
const ASSET_FILE_PATTERN = /^\/projects\/([0-9a-f-]{36})\/assets\/([a-zA-Z0-9._-]+)$/;

export function handleAssetRoute(req: Request): Promise<Response> | null {
  const url = new URL(req.url);

  const collectionMatch = ASSETS_PATTERN.exec(url.pathname);
  if (collectionMatch) {
    const projectId = collectionMatch[1];
    if (req.method === "POST") return uploadAssetController(req, projectId);
    if (req.method === "GET") return listAssetsController(req, projectId);
    return null;
  }

  const fileMatch = ASSET_FILE_PATTERN.exec(url.pathname);
  if (fileMatch) {
    const projectId = fileMatch[1];
    const filename = fileMatch[2];
    if (req.method === "DELETE")
      return deleteAssetController(req, projectId, filename);
    return null;
  }

  return null;
}
