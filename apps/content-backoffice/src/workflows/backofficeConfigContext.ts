import { createContext } from 'react';

export type BackofficeConfigValue = {
  enabled: string[];
  available: string[];
  effective: string[];
  /** Mirrors Strapi CONTENT_PUBLISHER_MUST_DIFFER (default true). */
  publisherMustDiffer: boolean;
  hasOverride: boolean;
  ready: boolean;
  setOverride: (ids: string[]) => void;
  clearOverride: () => void;
};

export const BackofficeConfigContext =
  createContext<BackofficeConfigValue | null>(null);
