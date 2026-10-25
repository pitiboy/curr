import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { strapiHttpClient } from 'ra-strapi';

import { STRAPI_URL } from '../config';
import {
  BackofficeConfigContext,
  type BackofficeConfigValue,
} from './backofficeConfigContext';
import {
  parseBackofficeConfig,
  type BackofficeConfigResponse,
} from './parseBackofficeConfig';

const httpClient = strapiHttpClient({ storage: localStorage });

const EMPTY_CONFIG: BackofficeConfigResponse = parseBackofficeConfig(null);

export function BackofficeConfigProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<BackofficeConfigResponse>(EMPTY_CONFIG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    httpClient(`${STRAPI_URL}/api/backoffice/config`)
      .then(({ json }) => {
        if (active) {
          setServer(parseBackofficeConfig(json));
        }
      })
      .catch(() => {
        if (active) {
          setServer(EMPTY_CONFIG);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<BackofficeConfigValue>(
    () => ({
      ...server,
      ready,
    }),
    [server, ready],
  );

  return (
    <BackofficeConfigContext.Provider value={value}>
      {children}
    </BackofficeConfigContext.Provider>
  );
}
