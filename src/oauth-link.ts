/**
 * Google login for users the admin created by hand.
 *
 * Stock users-permissions `providers.connect` only accepts a user whose
 * `provider` equals the OAuth provider. Admin-created users are
 * `provider: 'local'`, and with sign-ups off the first Google login fails with
 * "Register action is actually not available." The decision below lets that
 * login reach the existing user with the same (Google-verified) email. The
 * user row is not changed, so its role and password login stay as they are.
 */

/** Providers whose profile email is verified before connect sees it. */
export const LINKABLE_OAUTH_PROVIDERS = ['google'] as const;

/**
 * Login errors go to the BackOffice as stable codes, not sentences: Strapi
 * does not know the UI language, the SPA translates them
 * (apps/content-backoffice/src/auth/oauthErrors.ts).
 */
export const OAUTH_ERROR = {
  registerNotAvailable: 'oauth.register_not_available',
  ambiguousEmail: 'oauth.ambiguous_email',
  accountBlocked: 'oauth.account_blocked',
  emailNotConfirmed: 'oauth.email_not_confirmed',
  emailNotAvailable: 'oauth.email_not_available',
  emailTaken: 'oauth.email_taken',
} as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR)[keyof typeof OAUTH_ERROR];

/** Stock users-permissions connect messages, mapped to the same codes. */
const STOCK_MESSAGE_CODES: Record<string, OAuthErrorCode> = {
  'Register action is actually not available.': OAUTH_ERROR.registerNotAvailable,
  'Email was not available.': OAUTH_ERROR.emailNotAvailable,
  'Email is already taken.': OAUTH_ERROR.emailTaken,
  'Your account has been blocked by an administrator': OAUTH_ERROR.accountBlocked,
  'Your account email is not confirmed': OAUTH_ERROR.emailNotConfirmed,
};

/** The code for a stock connect message, or the message itself if unknown. */
export function toOAuthErrorCode(message: string): string {
  return STOCK_MESSAGE_CODES[message] ?? message;
}

export type OAuthLinkCandidate = {
  id: number | string;
  email?: string | null;
  provider?: string | null;
  blocked?: boolean | null;
  confirmed?: boolean | null;
};

export type OAuthLinkSettings = {
  email_confirmation?: boolean | null;
};

export type OAuthLinkDecision<U> =
  /** Not ours to decide: run the stock connect (reject or register). */
  | { type: 'stock' }
  /** Log this user in, as is. */
  | { type: 'login'; user: U; linked: boolean }
  | { type: 'reject'; message: OAuthErrorCode; reason: string };

export function isLinkableProvider(provider: string) {
  return (LINKABLE_OAUTH_PROVIDERS as readonly string[]).includes(provider);
}

export function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * `users` are the rows whose email matches the provider email
 * case-insensitively.
 */
export function decideOAuthLink<U extends OAuthLinkCandidate>(
  provider: string,
  email: string,
  users: U[],
  settings: OAuthLinkSettings | null | undefined,
): OAuthLinkDecision<U> {
  const wanted = normalizeEmail(email);
  if (!isLinkableProvider(provider) || !wanted) {
    return { type: 'stock' };
  }

  const sameEmail = users.filter((user) => normalizeEmail(user.email) === wanted);

  // A user that already signed up through this provider wins, as in stock.
  const own = sameEmail.find((user) => user.provider === provider);
  if (own) {
    return { type: 'login', user: own, linked: false };
  }

  if (sameEmail.length === 0) {
    return { type: 'stock' };
  }

  if (sameEmail.length > 1) {
    return {
      type: 'reject',
      message: OAUTH_ERROR.ambiguousEmail,
      reason: `${sameEmail.length} users share this email`,
    };
  }

  const [user] = sameEmail;
  if (user.blocked === true) {
    return { type: 'reject', message: OAUTH_ERROR.accountBlocked, reason: 'user is blocked' };
  }
  if (settings?.email_confirmation === true && user.confirmed !== true) {
    return {
      type: 'reject',
      message: OAUTH_ERROR.emailNotConfirmed,
      reason: 'user email is not confirmed',
    };
  }

  return { type: 'login', user, linked: true };
}
