export const CONTENT_ROLES = ['dataentry', 'editor'] as const;

export type ContentRole = (typeof CONTENT_ROLES)[number];

export function isContentRole(value: unknown): value is ContentRole {
  return (
    typeof value === 'string' &&
    (CONTENT_ROLES as readonly string[]).includes(value)
  );
}
