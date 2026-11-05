/** Editor on an unpublished show page: ask before leaving that page. */
export function shouldConfirmDraftLeave(input: {
  allowLeave?: boolean;
  isEditor: boolean;
  status: string | null | undefined;
  currentPathname: string;
  nextPathname: string;
}): boolean {
  if (input.allowLeave) return false;
  if (!input.isEditor || input.status !== 'draft') return false;
  return input.currentPathname !== input.nextPathname;
}

/** Create form with unsaved input: ask before leaving that page. */
export function shouldConfirmDirtyCreateLeave(input: {
  dirty: boolean;
  submitted: boolean;
  currentPathname: string;
  nextPathname: string;
}): boolean {
  if (!input.dirty || input.submitted) return false;
  return input.currentPathname !== input.nextPathname;
}
