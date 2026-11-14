export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number') return status;
  if (typeof status === 'string' && status.trim() !== '') {
    const parsed = Number(status);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return String(error);
}

/** HTTP 401 is retryable after re-login; other 4xx listed are permanent failures. */
export function classifyWriteFailure(error: unknown): {
  retryable: boolean;
  permanent: boolean;
} {
  if (error instanceof TypeError) {
    return { retryable: true, permanent: false };
  }
  const status = errorStatus(error);
  if (status === undefined) {
    const message = errorMessage(error).toLowerCase();
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('aborted')
    ) {
      return { retryable: true, permanent: false };
    }
    return { retryable: true, permanent: false };
  }
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return { retryable: true, permanent: false };
  }
  if (status === 401) {
    return { retryable: true, permanent: false };
  }
  if (
    status === 400 ||
    status === 403 ||
    status === 404 ||
    status === 409 ||
    status === 422
  ) {
    return { retryable: false, permanent: true };
  }
  if (status >= 500) {
    return { retryable: true, permanent: false };
  }
  return { retryable: false, permanent: true };
}
