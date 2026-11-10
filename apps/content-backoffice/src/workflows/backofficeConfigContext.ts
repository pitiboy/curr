import { createContext } from 'react';

import type { BackofficeConfigResponse } from './parseBackofficeConfig';

export type BackofficeConfigValue = BackofficeConfigResponse & {
  ready: boolean;
  /** Re-fetch `/api/backoffice/config` (e.g. after login). */
  reload: () => Promise<void>;
};

export const BackofficeConfigContext =
  createContext<BackofficeConfigValue | null>(null);
