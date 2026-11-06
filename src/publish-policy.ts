/**
 * Shared publish policy types/defaults for Strapi backoffice.
 * Kept separate from `publish-guard.ts` so `@strapi/utils` is not loaded when tests
 * import config parsing only.
 */

export type PublishPolicy = {
  /** `draft`: create/update cannot publish. `published`: an editor may save as published. */
  defaultStatus: 'draft' | 'published';
  /** When true, entered_by and the publisher must be different people. */
  publisherMustDiffer: boolean;
};

export const DEFAULT_PUBLISH_POLICY: PublishPolicy = {
  defaultStatus: 'draft',
  publisherMustDiffer: true,
};

/** Default policy when no database rows exist or the table is unavailable. */
export function readPublishPolicy(_ignored?: unknown): PublishPolicy {
  return { ...DEFAULT_PUBLISH_POLICY };
}
