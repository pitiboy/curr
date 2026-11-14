import { describe, expect, it } from 'vitest';

import {
  parseVersionJsonPayload,
  shouldReloadForBuildId,
} from './deployRefresh';

describe('shouldReloadForBuildId', () => {
  it('reloads when remote build differs', () => {
    expect(shouldReloadForBuildId('abc123', 'def456')).toBe(true);
  });

  it('skips when ids match or remote is missing', () => {
    expect(shouldReloadForBuildId('abc123', 'abc123')).toBe(false);
    expect(shouldReloadForBuildId('abc123', undefined)).toBe(false);
    expect(shouldReloadForBuildId('abc123', '')).toBe(false);
    expect(shouldReloadForBuildId('', 'abc123')).toBe(false);
  });
});

describe('parseVersionJsonPayload', () => {
  it('reads buildId string', () => {
    expect(parseVersionJsonPayload({ buildId: 'deadbeef' })).toEqual({
      buildId: 'deadbeef',
    });
  });

  it('returns empty for invalid payloads', () => {
    expect(parseVersionJsonPayload(null)).toEqual({});
    expect(parseVersionJsonPayload({ buildId: 1 })).toEqual({});
  });
});
