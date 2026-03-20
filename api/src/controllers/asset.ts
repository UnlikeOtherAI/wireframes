import { ApiError } from "../middleware/error-handler.js";
import { getUser } from "../middleware/auth.js";
import { uploadAsset, listAssets, deleteAsset } from "../services/asset.js";

function requireUser(req: Request) {
  const user = getUser(req);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

export async function uploadAssetController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw new ApiError(400, "Invalid multipart form data");
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new ApiError(400, "Missing file in upload");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const filename = file.name || "unnamed";

  const result = await uploadAsset(
    user.userId,
    projectId,
    buffer,
    filename,
    contentType,
  );

  return Response.json(result, { status: 201 });
}

export async function listAssetsController(
  req: Request,
  projectId: string,
): Promise<Response> {
  const user = requireUser(req);
  const assets = await listAssets(user.userId, projectId);
  return Response.json(assets);
}

export async function deleteAssetController(
  req: Request,
  projectId: string,
  filename: string,
): Promise<Response> {
  const user = requireUser(req);
  await deleteAsset(user.userId, projectId, filename);
  return new Response(null, { status: 204 });
}
