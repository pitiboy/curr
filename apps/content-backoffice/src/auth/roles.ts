export const CONTENT_ROLES = ['dataentry', 'editor', 'controller'] as const;

export type ContentRole = (typeof CONTENT_ROLES)[number];

export function isContentRole(value: unknown): value is ContentRole {
  return (
    typeof value === 'string' &&
    (CONTENT_ROLES as readonly string[]).includes(value)
  );
}

/** Publish / review / convert gates: editor and controller share the same SPA access. */
export function isEditorLike(value: unknown): boolean {
  return value === 'editor' || value === 'controller';
}

/** Whether `role` is allowed by a role list that may name `editor` for both editor-like roles. */
export function roleAllowed(allowed: readonly string[], role: string): boolean {
  if (allowed.includes(role)) return true;
  return isEditorLike(role) && allowed.includes('editor');
}
