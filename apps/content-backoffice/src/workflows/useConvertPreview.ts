import { strapiHttpClient } from 'ra-strapi';
import { useCallback, useEffect, useRef, useState } from 'react';

import { STRAPI_URL } from '../config';
import {
  fetchConvertPreview,
  type ConvertPreview,
  type ConvertPreviewRequest,
} from '../data/convertPreview';

const httpClient = strapiHttpClient({ storage: localStorage });

export function useConvertPreview(
  request: ConvertPreviewRequest | null,
  enabled: boolean,
) {
  const [preview, setPreview] = useState<ConvertPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!request || !enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConvertPreview(httpClient, STRAPI_URL, request);
      if (!controller.signal.aborted) {
        setPreview(data);
      }
    } catch (caught: unknown) {
      if (controller.signal.aborted) return;
      const message =
        caught instanceof Error ? caught.message : 'Convert preview failed';
      setPreview(null);
      setError(message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, request]);

  useEffect(() => {
    if (!enabled || !request) {
      abortRef.current?.abort();
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, load, request]);

  return { preview, loading, error, reload: load };
}
