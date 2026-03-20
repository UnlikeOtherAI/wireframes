import type { Handler } from "../middleware/types.js";
import { handleHealthRoute } from "./health.js";
import { handleAuthRoute } from "./auth.js";
import { handlePreviewRoute } from "./preview.js";
import { handleProjectRoute } from "./project.js";
import { handleBuildRoute } from "./build.js";
import { handleMembershipRoute } from "./membership.js";
import { handleUserProfileRoute } from "./user-profile.js";
import { handleAssetRoute } from "./asset.js";
import { handleChatRoute } from "./chat.js";

export const router: Handler = async (req) => {
  const healthResponse = handleHealthRoute(req);
  if (healthResponse) return healthResponse;

  const authResponse = handleAuthRoute(req);
  if (authResponse) return authResponse;

  const userProfileResponse = handleUserProfileRoute(req);
  if (userProfileResponse) return userProfileResponse;

  const membershipResponse = handleMembershipRoute(req);
  if (membershipResponse) return membershipResponse;

  const assetResponse = handleAssetRoute(req);
  if (assetResponse) return assetResponse;

  const chatResponse = handleChatRoute(req);
  if (chatResponse) return chatResponse;

  const buildResponse = handleBuildRoute(req);
  if (buildResponse) return buildResponse;

  const projectResponse = handleProjectRoute(req);
  if (projectResponse) return projectResponse;

  const previewResponse = handlePreviewRoute(req);
  if (previewResponse) return previewResponse;

  return Response.json({ error: "Not Found" }, { status: 404 });
};
