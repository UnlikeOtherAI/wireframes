import {
  viewPreview,
  authenticatePreview,
  buildPreviewCookie,
} from "../services/preview-auth.js";

export async function viewPreviewController(
  req: Request,
  slug: string,
  subPath: string,
): Promise<Response> {
  const cookieHeader = req.headers.get("Cookie");
  const result = await viewPreview(slug, subPath, cookieHeader);

  if (!result.allowed) {
    const body: Record<string, string> = {
      requiresAuth: result.requiresAuth!,
    };
    if (result.ssoUrl) {
      body.ssoUrl = result.ssoUrl;
    }
    return Response.json(body, { status: 401 });
  }

  return new Response(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType || "application/octet-stream",
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function authenticatePreviewController(
  req: Request,
  slug: string,
): Promise<Response> {
  const body = await req.json();
  const { token, slug: previewSlug } = await authenticatePreview(slug, body);
  const cookie = buildPreviewCookie(token, previewSlug);

  return Response.json(
    { authenticated: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": cookie,
      },
    },
  );
}
