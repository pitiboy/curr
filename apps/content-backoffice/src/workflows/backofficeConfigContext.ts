import { createContext } from 'react';

export type BackofficeConfigValue = {
  enabled: string[];
  available: string[];
  effective: string[];
  hasOverride: boolean;
  ready: boolean;
  setOverride: (ids: string[]) => void;
  clearOverride: () => void;
};

export const BackofficeConfigContext =
  createContext<BackofficeConfigValue | null>(null);
