import { createContext } from 'react';

import type { BackofficeConfigResponse } from './parseBackofficeConfig';

export type BackofficeConfigValue = BackofficeConfigResponse & {
  ready: boolean;
};

export const BackofficeConfigContext =
  createContext<BackofficeConfigValue | null>(null);
