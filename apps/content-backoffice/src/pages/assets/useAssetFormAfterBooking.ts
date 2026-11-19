import { strapiHttpClient } from 'ra-strapi';
import { useCallback } from 'react';
import { useNotify } from 'react-admin';
import { useNavigate } from 'react-router-dom';

import { STRAPI_URL } from '../../config';
import type { ConvertTransactionResult } from '../../data/transactionWorkflow';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';
import { ASSETS_FEATURE_ID } from './assetConstants';
import { ASSET_CREATE_PATH, assetCreatePathAfterBooking } from './assetPrefill';

const httpClient = strapiHttpClient({ storage: localStorage });

/** Whether a booked workflow should continue on the "Új eszköz" form. */
export function shouldCollectAsset(
  workflow: Pick<WorkflowTemplateHeader, 'collect_asset'> | null | undefined,
  enabledFeatures: readonly string[],
): boolean {
  return (
    workflow?.collect_asset === true &&
    enabledFeatures.includes(ASSETS_FEATURE_ID)
  );
}

/**
 * Returns a callback for the booking success path. Resolves `true` when it
 * navigated to the prefilled asset form (the caller then skips its own redirect).
 */
export function useAssetFormAfterBooking() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { enabled } = useBackofficeConfig();
  return useCallback(
    async (
      workflow: Pick<WorkflowTemplateHeader, 'collect_asset'> | null,
      originalDocumentId: string,
      result: Pick<ConvertTransactionResult, 'createdDocumentIds'> | null,
    ): Promise<boolean> => {
      if (!shouldCollectAsset(workflow, enabled)) return false;
      let path = ASSET_CREATE_PATH;
      try {
        path = await assetCreatePathAfterBooking(httpClient, STRAPI_URL, {
          originalDocumentId,
          createdDocumentIds: result?.createdDocumentIds ?? [],
        });
      } catch {
        // Prefill is a convenience: open the empty form rather than block.
      }
      notify('app.assets.collect_after_booking', { type: 'info' });
      navigate(path);
      return true;
    },
    [enabled, navigate, notify],
  );
}
