import { describe, expect, it } from 'vitest';

import { canPurgeExpansion, isContentRole, isEditorLike } from './roles';

describe('content roles', () => {
  it('accepts dataentry, editor and controller as content roles', () => {
    expect(isContentRole('dataentry')).toBe(true);
    expect(isContentRole('editor')).toBe(true);
    expect(isContentRole('controller')).toBe(true);
    expect(isContentRole('authenticated')).toBe(false);
  });

  it('treats editor and controller as editor-like', () => {
    expect(isEditorLike('editor')).toBe(true);
    expect(isEditorLike('controller')).toBe(true);
    expect(isEditorLike('dataentry')).toBe(false);
    expect(isEditorLike(undefined)).toBe(false);
  });

  it('allows purge-expansion for controller only', () => {
    expect(canPurgeExpansion('controller')).toBe(true);
    expect(canPurgeExpansion('editor')).toBe(false);
    expect(canPurgeExpansion('dataentry')).toBe(false);
  });
});
