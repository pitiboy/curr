import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decideOAuthLink,
  normalizeEmail,
  OAUTH_ERROR,
  toOAuthErrorCode,
} from './oauth-link.ts';

const local = (over: Record<string, unknown> = {}) => ({
  id: 1,
  email: 'peter@example.com',
  provider: 'local',
  blocked: false,
  confirmed: true,
  ...over,
});

describe('decideOAuthLink', () => {
  it('logs in an admin-created local user with the same email, unchanged', () => {
    const user = local();
    const decision = decideOAuthLink('google', 'peter@example.com', [user], {});
    assert.deepEqual(decision, { type: 'login', user, linked: true });
    assert.equal(user.provider, 'local');
  });

  it('matches the email case-insensitively', () => {
    const user = local({ email: 'Peter@Example.com' });
    const decision = decideOAuthLink('google', 'PETER@example.COM', [user], {});
    assert.equal(decision.type, 'login');
  });

  it('prefers a user that already signed up with the provider', () => {
    const google = local({ id: 2, provider: 'google' });
    const decision = decideOAuthLink('google', 'peter@example.com', [local(), google], {});
    assert.deepEqual(decision, { type: 'login', user: google, linked: false });
  });

  it('leaves unknown emails to the stock connect', () => {
    assert.deepEqual(decideOAuthLink('google', 'nobody@example.com', [], {}), {
      type: 'stock',
    });
  });

  it('ignores rows whose email does not actually match', () => {
    assert.deepEqual(
      decideOAuthLink('google', 'peter@example.com', [local({ email: 'other@example.com' })], {}),
      { type: 'stock' },
    );
  });

  it('leaves other providers and missing emails to the stock connect', () => {
    assert.deepEqual(decideOAuthLink('github', 'peter@example.com', [local()], {}), {
      type: 'stock',
    });
    assert.deepEqual(decideOAuthLink('google', '', [local()], {}), { type: 'stock' });
  });

  it('refuses blocked users', () => {
    const decision = decideOAuthLink('google', 'peter@example.com', [local({ blocked: true })], {});
    assert.equal(decision.type, 'reject');
    assert.equal(decision.type === 'reject' && decision.message, OAUTH_ERROR.accountBlocked);
  });

  it('refuses unconfirmed users only when email confirmation is on', () => {
    const user = local({ confirmed: false });
    const on = decideOAuthLink('google', 'peter@example.com', [user], {
      email_confirmation: true,
    });
    assert.equal(on.type === 'reject' && on.message, OAUTH_ERROR.emailNotConfirmed);
    const off = decideOAuthLink('google', 'peter@example.com', [user], {
      email_confirmation: false,
    });
    assert.equal(off.type, 'login');
  });

  it('refuses when several users share the email', () => {
    const decision = decideOAuthLink(
      'google',
      'peter@example.com',
      [local(), local({ id: 2, email: 'PETER@example.com' })],
      {},
    );
    assert.equal(decision.type === 'reject' && decision.message, OAUTH_ERROR.ambiguousEmail);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases, and returns empty for non-strings', () => {
    assert.equal(normalizeEmail('  A@B.hu '), 'a@b.hu');
    assert.equal(normalizeEmail(undefined), '');
  });
});

describe('toOAuthErrorCode', () => {
  it('maps stock connect messages to codes and keeps unknown ones', () => {
    assert.equal(
      toOAuthErrorCode('Register action is actually not available.'),
      OAUTH_ERROR.registerNotAvailable,
    );
    assert.equal(toOAuthErrorCode('Email is already taken.'), OAUTH_ERROR.emailTaken);
    assert.equal(toOAuthErrorCode('Something else'), 'Something else');
  });
});
