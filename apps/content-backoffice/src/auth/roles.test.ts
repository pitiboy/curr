import { describe, expect, it } from 'vitest';

import {
  canPurgeExpansion,
  CONTENT_ROLES,
  EDITOR_LIKE_ROLES,
  isContentRole,
  isEditorLikeRole,
  roleAllowed,
} from './roles';

describe('content roles', () => {
  it('lists dataentry, editor, and controller', () => {
    expect(CONTENT_ROLES).toEqual(['dataentry', 'editor', 'controller']);
  });

  it('treats editor and controller as editor-like', () => {
    expect(EDITOR_LIKE_ROLES).toEqual(['editor', 'controller']);
    expect(isEditorLikeRole('editor')).toBe(true);
    expect(isEditorLikeRole('controller')).toBe(true);
    expect(isEditorLikeRole('dataentry')).toBe(false);
    expect(isEditorLikeRole(undefined)).toBe(false);
  });

  it('accepts all three content roles', () => {
    expect(isContentRole('dataentry')).toBe(true);
    expect(isContentRole('editor')).toBe(true);
    expect(isContentRole('controller')).toBe(true);
    expect(isContentRole('admin')).toBe(false);
  });

  it('lets controller pass gates that list editor', () => {
    expect(roleAllowed(['dataentry', 'editor'], 'controller')).toBe(true);
    expect(roleAllowed(['dataentry'], 'controller')).toBe(false);
    expect(roleAllowed(['controller'], 'controller')).toBe(true);
  });

  it('limits purge-expansion to controller', () => {
    expect(canPurgeExpansion('controller')).toBe(true);
    expect(canPurgeExpansion('editor')).toBe(false);
    expect(canPurgeExpansion('dataentry')).toBe(false);
  });
});
