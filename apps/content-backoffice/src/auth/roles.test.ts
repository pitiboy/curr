import { describe, expect, it } from 'vitest';

import { isContentRole, isEditorLike, roleAllowed } from './roles';

describe('roles', () => {
  it('recognizes content roles including controller', () => {
    expect(isContentRole('dataentry')).toBe(true);
    expect(isContentRole('editor')).toBe(true);
    expect(isContentRole('controller')).toBe(true);
    expect(isContentRole('authenticated')).toBe(false);
  });

  it('treats controller as editor-like', () => {
    expect(isEditorLike('editor')).toBe(true);
    expect(isEditorLike('controller')).toBe(true);
    expect(isEditorLike('dataentry')).toBe(false);
  });

  it('lets controller pass gates that list editor', () => {
    expect(roleAllowed(['dataentry', 'editor'], 'controller')).toBe(true);
    expect(roleAllowed(['dataentry'], 'controller')).toBe(false);
    expect(roleAllowed(['controller'], 'controller')).toBe(true);
  });
});
