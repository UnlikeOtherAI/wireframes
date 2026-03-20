import type { Handler } from "../middleware/types.js";
import { handleHealthRoute } from "./health.js";
import { handleAuthRoute } from "./auth.js";
import { handlePreviewRoute } from "./preview.js";

export const router: Handler = async (req) => {
  const healthResponse = handleHealthRoute(req);
  if (healthResponse) return healthResponse;

  const authResponse = handleAuthRoute(req);
  if (authResponse) return authResponse;

  const previewResponse = handlePreviewRoute(req);
  if (previewResponse) return previewResponse;

  return Response.json({ error: "Not Found" }, { status: 404 });
};
