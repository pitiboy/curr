import { STRAPI_URL } from '../config';
import { persistStrapiAuthSession } from './strapiAuthStorage';

const OAUTH_PENDING_KEY = 'backoffice_google_oauth_pending';

export function backofficeOAuthCallbackUrl(): string {
  const base = import.meta.env.BASE_URL || '/backoffice/';
  const path = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${path}`;
}

export function startGoogleLogin(): void {
  sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
  const callback = encodeURIComponent(backofficeOAuthCallbackUrl());
  window.location.assign(
    `${STRAPI_URL}/api/connect/google?callback=${callback}`,
  );
}

export function isGoogleOAuthReturn(): boolean {
  return sessionStorage.getItem(OAUTH_PENDING_KEY) === '1';
}

type AuthCallbackResponse = {
  jwt: string;
  user: unknown;
};

export async function completeGoogleLoginFromSession(): Promise<boolean> {
  if (!isGoogleOAuthReturn()) {
    return false;
  }
  sessionStorage.removeItem(OAUTH_PENDING_KEY);

  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    throw new Error(params.get('error_description') ?? error);
  }

  const response = await fetch(`${STRAPI_URL}/api/auth/google/callback`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `Google sign-in failed (${response.status})`,
    );
  }

  const { jwt, user } = (await response.json()) as AuthCallbackResponse;
  persistStrapiAuthSession(jwt, user);
  return true;
}
