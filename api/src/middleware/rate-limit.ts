export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

interface SlidingWindow {
  timestamps: number[];
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    req.headers.get("X-Real-IP") ||
    "unknown"
  );
}

export function createRateLimiter(
  options: RateLimitOptions,
): (req: Request) => Response | null {
  const windows = new Map<string, SlidingWindow>();

  // Clean up stale entries every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of windows) {
      window.timestamps = window.timestamps.filter(
        (t) => now - t < options.windowMs,
      );
      if (window.timestamps.length === 0) {
        windows.delete(key);
      }
    }
  }, 60_000);
  cleanupInterval.unref();

  return (req: Request): Response | null => {
    const ip = getClientIp(req);
    const now = Date.now();

    let window = windows.get(ip);
    if (!window) {
      window = { timestamps: [] };
      windows.set(ip, window);
    }

    window.timestamps = window.timestamps.filter(
      (t) => now - t < options.windowMs,
    );

    if (window.timestamps.length >= options.maxRequests) {
      const oldest = window.timestamps[0];
      const retryAfter = Math.ceil((oldest + options.windowMs - now) / 1000);
      return Response.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }

    window.timestamps.push(now);
    return null;
  };
}
