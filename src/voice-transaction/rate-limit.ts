/** Fixed-window, in-memory, per-key limiter (single Strapi process). */
export type RateLimiter = {
  /** True when the call is allowed (and counted). */
  take: (key: string) => boolean;
};

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  return {
    take(key: string): boolean {
      const t = now();
      if (windows.size > 1000) {
        for (const [k, w] of windows) {
          if (t - w.start >= options.windowMs) windows.delete(k);
        }
      }
      const current = windows.get(key);
      if (!current || t - current.start >= options.windowMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      if (current.count >= options.limit) return false;
      current.count += 1;
      return true;
    },
  };
}

export function rateLimiterFromEnv(
  env: Record<string, string | undefined> = process.env,
): RateLimiter {
  const limit = Number.parseInt(env.VOICE_PARSE_RATE_LIMIT ?? '', 10);
  const windowSeconds = Number.parseInt(
    env.VOICE_PARSE_RATE_WINDOW_SECONDS ?? '',
    10,
  );
  return createRateLimiter({
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    windowMs:
      (Number.isFinite(windowSeconds) && windowSeconds > 0
        ? windowSeconds
        : 60) * 1000,
  });
}
