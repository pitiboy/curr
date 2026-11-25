import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ra-strapi', () => ({ strapiHttpClient: () => vi.fn() }));

const notify = vi.fn();
vi.mock('react-admin', () => ({ useNotify: () => notify }));

const backofficeConfig = { enabled: ['assets'] as string[] };
vi.mock('../../workflows/useBackofficeConfig', () => ({
  useBackofficeConfig: () => backofficeConfig,
}));

const assetCreatePathAfterBooking = vi.fn();
vi.mock('./assetPrefill', () => ({
  ASSET_CREATE_PATH: '/assets/create',
  assetCreatePathAfterBooking: (...args: unknown[]) =>
    assetCreatePathAfterBooking(...args),
}));

import {
  shouldCollectAsset,
  useAssetFormAfterBooking,
} from './useAssetFormAfterBooking';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/transactions/create']}>
      {children}
    </MemoryRouter>
  );
}

function useHarness() {
  return { open: useAssetFormAfterBooking(), location: useLocation() };
}

describe('shouldCollectAsset', () => {
  it('needs the workflow flag and the enabled assets feature', () => {
    expect(shouldCollectAsset({ collect_asset: true }, ['assets'])).toBe(true);
    expect(shouldCollectAsset({ collect_asset: false }, ['assets'])).toBe(
      false,
    );
    expect(shouldCollectAsset({ collect_asset: true }, [])).toBe(false);
    expect(shouldCollectAsset(null, ['assets'])).toBe(false);
  });
});

describe('useAssetFormAfterBooking', () => {
  beforeEach(() => {
    backofficeConfig.enabled = ['assets'];
    assetCreatePathAfterBooking.mockReset();
    notify.mockReset();
  });

  it('navigates to the prefilled "Új eszköz" form for collect_asset workflows', async () => {
    assetCreatePathAfterBooking.mockResolvedValue(
      '/assets/create?source=%7B%22purchase_price%22%3A10%7D',
    );
    const { result } = renderHook(() => useHarness(), { wrapper });
    let opened = false;
    await act(async () => {
      opened = await result.current.open({ collect_asset: true }, 'tx-1', {
        createdDocumentIds: ['leg-1'],
      });
    });
    expect(opened).toBe(true);
    expect(assetCreatePathAfterBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      { originalDocumentId: 'tx-1', createdDocumentIds: ['leg-1'] },
    );
    expect(result.current.location.pathname).toBe('/assets/create');
    expect(
      JSON.parse(
        new URLSearchParams(result.current.location.search).get('source')!,
      ),
    ).toEqual({ purchase_price: 10 });
    expect(notify).toHaveBeenCalledWith('app.assets.collect_after_booking', {
      type: 'info',
    });
  });

  it('does nothing for workflows without the flag or with the feature off', async () => {
    const { result } = renderHook(() => useHarness(), { wrapper });
    await act(async () => {
      expect(
        await result.current.open({ collect_asset: false }, 'tx-1', null),
      ).toBe(false);
    });
    backofficeConfig.enabled = [];
    const second = renderHook(() => useHarness(), { wrapper });
    await act(async () => {
      expect(
        await second.result.current.open({ collect_asset: true }, 'tx-1', null),
      ).toBe(false);
    });
    expect(assetCreatePathAfterBooking).not.toHaveBeenCalled();
    expect(result.current.location.pathname).toBe('/transactions/create');
  });

  it('still opens the empty form when the prefill lookup fails', async () => {
    assetCreatePathAfterBooking.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useHarness(), { wrapper });
    await act(async () => {
      await result.current.open({ collect_asset: true }, 'tx-1', null);
    });
    expect(result.current.location.pathname).toBe('/assets/create');
  });
});
