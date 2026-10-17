/**
 * Google login errors from Strapi. The backend sends stable codes
 * (src/oauth-link.ts, OAUTH_ERROR); a few messages come straight from the
 * stock auth controller, so those are mapped to codes here.
 */
const OAUTH_ERROR_KEYS: Record<string, string> = {
  'oauth.register_not_available': 'register_not_available',
  'oauth.ambiguous_email': 'ambiguous_email',
  'oauth.account_blocked': 'account_blocked',
  'oauth.email_not_confirmed': 'email_not_confirmed',
  'oauth.email_not_available': 'email_not_available',
  'oauth.email_taken': 'email_taken',
  'Your account has been blocked by an administrator': 'account_blocked',
  'OAuth authentication requires a completed provider session': 'session_missing',
  'This provider is disabled': 'provider_disabled',
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Translated text for a login error; unknown messages are shown as they are. */
export function translateOAuthError(message: string, translate: Translate): string {
  const key = OAUTH_ERROR_KEYS[message];
  return key ? translate(`app.oauth_errors.${key}`, { _: message }) : message;
}
