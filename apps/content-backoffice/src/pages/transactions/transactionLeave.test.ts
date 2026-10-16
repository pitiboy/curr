import { describe, expect, it } from 'vitest';

import {
  shouldConfirmDirtyCreateLeave,
  shouldConfirmDraftLeave,
} from './transactionLeave';

describe('shouldConfirmDraftLeave', () => {
  const draft = {
    isEditor: true,
    status: 'draft' as const,
    currentPathname: '/transactions/doc-1/show',
    nextPathname: '/transactions',
  };

  it('asks an editor who leaves an unpublished transaction', () => {
    expect(shouldConfirmDraftLeave(draft)).toBe(true);
  });

  it('stays quiet when the location does not change', () => {
    expect(
      shouldConfirmDraftLeave({
        ...draft,
        nextPathname: draft.currentPathname,
      }),
    ).toBe(false);
  });

  it('stays quiet for a published transaction', () => {
    expect(shouldConfirmDraftLeave({ ...draft, status: 'published' })).toBe(
      false,
    );
  });

  it('stays quiet for a dataentry user', () => {
    expect(shouldConfirmDraftLeave({ ...draft, isEditor: false })).toBe(false);
  });
});

describe('shouldConfirmDirtyCreateLeave', () => {
  const dirty = {
    dirty: true,
    submitted: false,
    currentPathname: '/transactions/create',
    nextPathname: '/transactions',
  };

  it('asks when the create form has unsaved input', () => {
    expect(shouldConfirmDirtyCreateLeave(dirty)).toBe(true);
  });

  it('stays quiet on a clean create form', () => {
    expect(shouldConfirmDirtyCreateLeave({ ...dirty, dirty: false })).toBe(
      false,
    );
  });

  it('stays quiet after a successful save', () => {
    expect(shouldConfirmDirtyCreateLeave({ ...dirty, submitted: true })).toBe(
      false,
    );
  });

  it('stays quiet when the location does not change', () => {
    expect(
      shouldConfirmDirtyCreateLeave({
        ...dirty,
        nextPathname: dirty.currentPathname,
      }),
    ).toBe(false);
  });
});
