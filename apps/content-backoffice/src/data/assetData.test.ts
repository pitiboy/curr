import { describe, expect, it } from 'vitest';

import {
  ASSET_SEARCH_FIELDS,
  ASSET_SORT_PATHS,
  assetBody,
  buildAssetFilters,
  buildAssetListQuery,
  buildAssetSort,
  fetchAssetList,
  resolvePhotoId,
  toAssetRecord,
} from './assetData';

describe('asset list search', () => {
  it('searches name, serial number, location and notes (case-insensitive)', () => {
    expect(ASSET_SEARCH_FIELDS).toEqual([
      'name',
      'serial_number',
      'location',
      'notes',
    ]);
    expect(buildAssetFilters({ q: '  stihl ' })).toEqual({
      $or: [
        { name: { $containsi: 'stihl' } },
        { serial_number: { $containsi: 'stihl' } },
        { location: { $containsi: 'stihl' } },
        { notes: { $containsi: 'stihl' } },
      ],
    });
  });

  it('ignores an empty search', () => {
    expect(buildAssetFilters({ q: '   ' })).toEqual({});
  });

  it('combines search with category, ownership, status and organization filters', () => {
    expect(
      buildAssetFilters({
        q: 'x',
        category: 'cat-1',
        ownership_type: 'coop_owned',
        status: ['in_use', 'lent_out'],
        organization: 'org-a',
      }),
    ).toEqual({
      $and: [
        {
          $or: ASSET_SEARCH_FIELDS.map((field) => ({
            [field]: { $containsi: 'x' },
          })),
        },
        { ownership_type: { $eq: 'coop_owned' } },
        { status: { $in: ['in_use', 'lent_out'] } },
        { category: { documentId: { $eq: 'cat-1' } } },
        { organization: { documentId: { $eq: 'org-a' } } },
      ],
    });
  });
});

describe('asset list sort', () => {
  it('maps every sortable column to a Strapi path', () => {
    for (const column of [
      'name',
      'category',
      'ownership_type',
      'status',
      'responsible_member',
      'location',
      'purchase_price',
      'currency_type',
      'purchase_date',
      'warranty_until',
      'organization',
      'acquisition_transaction',
    ]) {
      expect(ASSET_SORT_PATHS[column], column).toBeTruthy();
    }
  });

  it('sorts relation columns by their label with name as tie-breaker', () => {
    expect(buildAssetSort({ field: 'category', order: 'DESC' })).toEqual([
      { category: { name: 'desc' } },
      { name: 'asc' },
    ]);
    expect(buildAssetSort({ field: 'currency_type', order: 'ASC' })).toEqual([
      { currency_type: { code: 'asc' } },
      { name: 'asc' },
    ]);
  });

  it('falls back to name for unknown columns', () => {
    expect(buildAssetSort({ field: 'refs', order: 'ASC' })).toEqual([
      { name: 'asc' },
    ]);
    expect(buildAssetSort()).toEqual([{ name: 'asc' }]);
  });
});

describe('fetchAssetList', () => {
  it('sends search, sort and pagination to /api/assets and maps rows', async () => {
    let seen = '';
    const result = await fetchAssetList(
      async (url) => {
        seen = url;
        return {
          json: {
            data: [
              {
                id: 3,
                documentId: 'asset-1',
                name: 'Traktor',
                purchase_price: '1500000.00',
                ownership_type: 'coop_owned',
                status: 'in_use',
                category: { documentId: 'cat-1', name: 'Járművek' },
                currency_type: { documentId: 'cur-huf', code: 'HUF' },
                organization: { documentId: 'org-a', name: 'Kert' },
                acquisition_transaction: {
                  documentId: 'tx-1',
                  date: '2026-01-02',
                  amount: '1500000',
                  currency_type: { code: 'HUF' },
                },
                photo: {
                  id: 9,
                  url: '/uploads/t.jpg',
                  formats: { thumbnail: { url: '/uploads/thumb_t.jpg' } },
                },
              },
            ],
            meta: { pagination: { total: 41 } },
          },
        };
      },
      'http://api.test',
      {
        filter: { q: 'trak' },
        sort: { field: 'purchase_date', order: 'DESC' },
        pagination: { page: 2, perPage: 10 },
      },
    );
    const params = new URL(seen).searchParams;
    expect(new URL(seen).pathname).toBe('/api/assets');
    expect(params.get('filters[$or][0][name][$containsi]')).toBe('trak');
    expect(params.get('filters[$or][3][notes][$containsi]')).toBe('trak');
    expect(params.get('sort[0][purchase_date]')).toBe('desc');
    expect(params.get('pagination[page]')).toBe('2');
    expect(params.get('pagination[pageSize]')).toBe('10');
    expect(params.get('populate[category][fields][1]')).toBe('name');
    expect(result.total).toBe(41);
    expect(result.data[0]).toMatchObject({
      id: 'asset-1',
      category: 'cat-1',
      currency_type: 'cur-huf',
      organization: 'org-a',
      acquisition_transaction: 'tx-1',
      purchase_price: 1500000,
      refs: {
        category: { name: 'Járművek' },
        currency_type: { code: 'HUF' },
        acquisition_transaction: { documentId: 'tx-1', currencyCode: 'HUF' },
      },
      photo: { thumbnailUrl: 'http://api.test/uploads/thumb_t.jpg' },
    });
  });

  it('builds a default query (name asc, first page)', () => {
    expect(buildAssetListQuery({})).toMatchObject({
      sort: [{ name: 'asc' }],
      pagination: { page: 1, pageSize: 25 },
    });
    expect(buildAssetListQuery({})).not.toHaveProperty('filters');
  });
});

describe('assetBody', () => {
  it('whitelists fields, sends relations as documentIds and clears emptied ones', () => {
    const record = toAssetRecord({ documentId: 'a', name: 'x' });
    expect(
      assetBody({
        ...record,
        name: ' Fűnyíró ',
        purchase_price: '12000',
        purchase_date: '2026-05-01',
        category: 'cat-1',
        responsible_member: '',
        acquisition_transaction: { documentId: 'tx-9' },
        organization: 'org-a',
        notes: '',
      }),
    ).toEqual({
      name: 'Fűnyíró',
      purchase_price: 12000,
      purchase_date: '2026-05-01',
      warranty_until: null,
      location: null,
      serial_number: null,
      notes: null,
      category: 'cat-1',
      currency_type: { set: [] },
      responsible_member: { set: [] },
      organization: 'org-a',
      acquisition_transaction: 'tx-9',
      disposal_transaction: { set: [] },
    });
  });
});

describe('resolvePhotoId', () => {
  it('uploads a new image and returns the media id', async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    const id = await resolvePhotoId(
      async (url, options) => {
        calls.push({ url, method: options?.method, body: options?.body });
        return { json: [{ id: 42 }] };
      },
      'http://api.test',
      { rawFile: new File(['x'], 'photo.png', { type: 'image/png' }) },
    );
    expect(id).toBe(42);
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/upload',
      method: 'POST',
    });
    expect(calls[0]!.body).toBeInstanceOf(FormData);
  });

  it('keeps an existing photo id and clears a removed one', async () => {
    const httpClient = async () => {
      throw new Error('no upload expected');
    };
    expect(
      await resolvePhotoId(httpClient, '', {
        id: 7,
        url: '/u.png',
        thumbnailUrl: '/u.png',
        src: '/u.png',
        title: '',
      }),
    ).toBe(7);
    expect(await resolvePhotoId(httpClient, '', null)).toBeNull();
  });
});
