import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { strapiHttpClient } from 'ra-strapi';

import {
  STRAPI_AUTH_CHANGED_EVENT,
  STRAPI_JWT_KEY,
} from '../auth/strapiAuthStorage';
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

export function BackofficeConfigProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [server, setServer] = useState<BackofficeConfigResponse>(EMPTY_CONFIG);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const jwt = localStorage.getItem(STRAPI_JWT_KEY);
    if (!jwt) {
      setServer(EMPTY_CONFIG);
      setReady(true);
      return;
    }
    try {
      const { json } = await httpClient(`${STRAPI_URL}/api/backoffice/config`);
      setServer(parseBackofficeConfig(json));
    } catch {
      setServer(EMPTY_CONFIG);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void reload();

    const onAuthChanged = () => {
      void reload();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STRAPI_JWT_KEY) void reload();
    };

    window.addEventListener(STRAPI_AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(STRAPI_AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload]);

  const value = useMemo<BackofficeConfigValue>(
    () => ({
      ...server,
      ready,
      reload,
    }),
    [server, ready, reload],
  );

  return (
    <BackofficeConfigContext.Provider value={value}>
      {children}
    </BackofficeConfigContext.Provider>
  );
}
