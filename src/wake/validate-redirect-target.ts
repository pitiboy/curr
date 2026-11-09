/**
 * Validates a post-wake redirect target as same-origin safe (relative path only).
 * Rejects protocol-relative and absolute URLs to prevent open redirects.
 */
export function normalizeRedirectTarget(
  raw: string | null | undefined,
  fallback = '/backoffice/',
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed;
}

export function isSafeSameOriginRedirectPath(path: string): boolean {
  if (!path.startsWith('/')) {
    return false;
  }
  if (path.startsWith('//')) {
    return false;
  }
  if (path.includes('://') || path.includes('\\')) {
    return false;
  }
  try {
    const resolved = new URL(path, 'https://placeholder.local');
    return resolved.origin === 'https://placeholder.local';
  } catch {
    return false;
  }
}

export function resolveRedirectTarget(
  raw: string | null | undefined,
  fallback = '/backoffice/',
): string | null {
  const normalized = normalizeRedirectTarget(raw, fallback);
  return isSafeSameOriginRedirectPath(normalized) ? normalized : null;
}
