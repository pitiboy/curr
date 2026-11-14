import { describe, expect, it } from 'vitest';

import { classifyWriteFailure, isNetworkFailure } from './errors';

describe('isNetworkFailure', () => {
  it('detects TypeError Failed to fetch', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('detects status 0', () => {
    expect(isNetworkFailure({ status: 0 })).toBe(true);
  });

  it('rejects ordinary HTTP errors', () => {
    expect(isNetworkFailure({ status: 503 })).toBe(false);
    expect(isNetworkFailure({ status: 422 })).toBe(false);
  });
});

describe('classifyWriteFailure', () => {
  it('treats network TypeError as retryable', () => {
    expect(classifyWriteFailure(new TypeError('Failed to fetch'))).toEqual({
      retryable: true,
      permanent: false,
    });
  });

  it('treats 502–504 and 0 as retryable', () => {
    for (const status of [0, 502, 503, 504]) {
      expect(classifyWriteFailure({ status })).toEqual({
        retryable: true,
        permanent: false,
      });
    }
  });

  it('treats 401 as retryable', () => {
    expect(classifyWriteFailure({ status: 401 })).toEqual({
      retryable: true,
      permanent: false,
    });
  });

  it('treats validation-related 4xx as permanent', () => {
    for (const status of [400, 403, 404, 409, 422]) {
      expect(classifyWriteFailure({ status })).toEqual({
        retryable: false,
        permanent: true,
      });
    }
  });
});
