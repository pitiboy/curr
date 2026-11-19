import { describe, expect, it } from 'vitest';

import {
  ASSET_CREATE_PATH,
  acquisitionFieldPrefill,
  assetCreatePathAfterBooking,
  assetCreatePathWithPrefill,
  buildAssetPrefillRecord,
  findMemberByAccount,
  loadAcquisitionPrefill,
  pickAcquisitionTransactionId,
  prefillChanges,
} from './assetPrefill';

function sourceFromPath(path: string): Record<string, unknown> {
  const url = new URL(path, 'http://localhost');
  expect(url.pathname).toBe(ASSET_CREATE_PATH);
  return JSON.parse(url.searchParams.get('source') ?? '{}');
}

describe('buildAssetPrefillRecord', () => {
  it('maps price, currency, date, organization and the linked transaction', () => {
    expect(
      buildAssetPrefillRecord({
        amount: '125000.50',
        currencyTypeId: 'cur-huf',
        date: '2026-11-03',
        organizationId: 'org-a',
        description: 'Fűkasza Stihl | Eszköz beszerzés – szállítói számla',
        acquisitionTransactionId: 'tx-1500',
      }),
    ).toEqual({
      name: 'Fűkasza Stihl',
      ownership_type: 'coop_owned',
      status: 'in_use',
      purchase_price: 125000.5,
      currency_type: 'cur-huf',
      purchase_date: '2026-11-03',
      organization: 'org-a',
      acquisition_transaction: 'tx-1500',
    });
  });

  it('leaves out missing / invalid values', () => {
    expect(
      buildAssetPrefillRecord({ amount: 'abc', date: '', description: ' ' }),
    ).toEqual({ ownership_type: 'coop_owned', status: 'in_use' });
  });
});

describe('assetCreatePathWithPrefill', () => {
  it('encodes the record as the React Admin `source` param', () => {
    const record = buildAssetPrefillRecord({
      amount: 10,
      organizationId: 'org-a',
    });
    expect(sourceFromPath(assetCreatePathWithPrefill(record))).toEqual(record);
  });
});

describe('pickAcquisitionTransactionId', () => {
  const legs = [
    { documentId: 'leg-pay', amount: 100, debit_account: { code: '2000' } },
    { documentId: 'leg-1500', amount: 100, debit_account: { code: '1500' } },
  ];

  it('links the first booked leg that debits 1500', () => {
    expect(
      pickAcquisitionTransactionId(['leg-pay', 'leg-1500'], legs, 'orig'),
    ).toBe('leg-1500');
  });

  it('falls back to the original when no leg debits 1500', () => {
    expect(pickAcquisitionTransactionId(['leg-pay'], legs, 'orig')).toBe(
      'orig',
    );
    expect(pickAcquisitionTransactionId([], [], 'orig')).toBe('orig');
  });
});

describe('assetCreatePathAfterBooking', () => {
  it('loads the booked original + legs and builds the prefilled path', async () => {
    const seen: string[] = [];
    const httpClient = async (url: string) => {
      seen.push(url);
      if (url.includes('/api/transactions/tx-orig')) {
        const published = url.includes('status=published');
        return {
          json: {
            data: published
              ? null
              : {
                  documentId: 'tx-orig',
                  amount: '80000',
                  date: '2026-10-01',
                  description: 'Szivattyú',
                  currency_type: { documentId: 'cur-huf', code: 'HUF' },
                  organization: { documentId: 'org-a', name: 'A' },
                },
          },
        };
      }
      const published = url.includes('status=published');
      return {
        json: {
          data: published
            ? [
                {
                  documentId: 'leg-1500',
                  amount: '80000',
                  debit_account: { code: '1500' },
                },
                {
                  documentId: 'leg-pay',
                  amount: '80000',
                  debit_account: { code: '2000' },
                },
              ]
            : [],
          meta: { pagination: { pageCount: 1 } },
        },
      };
    };

    const path = await assetCreatePathAfterBooking(
      httpClient,
      'http://localhost:1337',
      {
        originalDocumentId: 'tx-orig',
        createdDocumentIds: ['leg-1500', 'leg-pay'],
      },
    );

    expect(sourceFromPath(path)).toEqual({
      name: 'Szivattyú',
      ownership_type: 'coop_owned',
      status: 'in_use',
      purchase_price: 80000,
      currency_type: 'cur-huf',
      purchase_date: '2026-10-01',
      organization: 'org-a',
      acquisition_transaction: 'leg-1500',
    });
    const legQuery = seen.find((url) => url.includes('filters'));
    expect(decodeURIComponent(legQuery ?? '')).toContain(
      'filters[documentId][$in][0]=leg-1500',
    );
  });
});

describe('acquisitionFieldPrefill', () => {
  const tx = {
    amount: '7878',
    date: '2026-11-19T00:00:00.000Z',
    description: 'Lapát | Vásárlás',
    currency_type: { documentId: 'huf' },
    organization: { documentId: 'org' },
  };

  it('maps the transaction onto the asset fields', () => {
    expect(acquisitionFieldPrefill(tx, { memberId: 'm1' })).toEqual({
      name: 'Lapát',
      purchase_price: 7878,
      currency_type: 'huf',
      purchase_date: '2026-11-19',
      organization: 'org',
      responsible_member: 'm1',
    });
  });

  it('offers only what is still free on the transaction', () => {
    expect(
      acquisitionFieldPrefill(tx, { linkedTotal: 5000 }).purchase_price,
    ).toBe(2878);
    expect(
      acquisitionFieldPrefill(tx, { linkedTotal: 7878 }),
    ).not.toHaveProperty('purchase_price');
  });
});

describe('prefillChanges', () => {
  it('fills empty fields and keeps what the user typed', () => {
    expect(
      prefillChanges(
        { name: 'Saját név', purchase_price: null, organization: '' },
        { name: 'Lapát', purchase_price: 100, organization: 'org' },
      ),
    ).toEqual({ purchase_price: 100, organization: 'org' });
  });

  it('follows a new pick on fields the previous pick filled', () => {
    expect(
      prefillChanges(
        { purchase_price: 100, currency_type: 'huf', name: 'Kézzel' },
        { purchase_price: 250, currency_type: 'huf', name: 'Talicska' },
        { purchase_price: 100, currency_type: 'huf', name: 'Lapát' },
      ),
    ).toEqual({ purchase_price: 250 });
  });
});

describe('findMemberByAccount', () => {
  it('matches a share or pocket account, leg account first', async () => {
    const client = async () => ({
      json: {
        data: [
          { documentId: 'm-orig', account: { documentId: 'acc-orig' } },
          { documentId: 'm-leg', private_account: { documentId: 'acc-leg' } },
        ],
        meta: { pagination: { pageCount: 1 } },
      },
    });
    await expect(
      findMemberByAccount(client as never, ['acc-leg', 'acc-orig']),
    ).resolves.toBe('m-leg');
    await expect(
      findMemberByAccount(client as never, ['nobody']),
    ).resolves.toBeNull();
    await expect(findMemberByAccount(client as never, [])).resolves.toBeNull();
  });
});

describe('loadAcquisitionPrefill', () => {
  type Opts = {
    legCredit?: string;
    originalCredit?: string;
    members?: unknown[];
    linkedAssets?: unknown[];
  };

  function fakeClient(opts: Opts = {}) {
    const seen: string[] = [];
    const client = async (url: string) => {
      const decoded = decodeURIComponent(url);
      seen.push(decoded);
      const list = (data: unknown[]) => ({
        json: { data, meta: { pagination: { pageCount: 1 } } },
      });
      if (decoded.includes('/api/transactions/tx-leg')) {
        if (!decoded.includes('status=published'))
          return { json: { data: null } };
        return {
          json: {
            data: {
              documentId: 'tx-leg',
              amount: '7878',
              date: '2026-11-19',
              description: 'Lapát | Vásárlás',
              currency_type: { documentId: 'huf', code: 'HUF' },
              organization: { documentId: 'org-1' },
              credit_account: { documentId: opts.legCredit ?? 'acc-1000' },
              related_transaction: {
                documentId: 'tx-orig',
                credit_account: {
                  documentId: opts.originalCredit ?? 'acc-1001',
                },
              },
            },
          },
        };
      }
      if (decoded.includes('/api/assets')) return list(opts.linkedAssets ?? []);
      if (decoded.includes('/api/members')) return list(opts.members ?? []);
      return list([]);
    };
    return { client, seen };
  }

  it('falls back to the original deal credit account for the member', async () => {
    const { client, seen } = fakeClient({
      members: [
        { documentId: 'member-1', account: { documentId: 'acc-1001' } },
      ],
    });
    const prefill = await loadAcquisitionPrefill(
      client as never,
      'http://strapi',
      'tx-leg',
    );
    expect(prefill).toEqual({
      name: 'Lapát',
      purchase_price: 7878,
      currency_type: 'huf',
      purchase_date: '2026-11-19',
      organization: 'org-1',
      responsible_member: 'member-1',
    });
    const memberQuery = seen.find((u) => u.includes('/api/members'))!;
    expect(memberQuery).toContain('acc-1000');
    expect(memberQuery).toContain('acc-1001');
  });

  it('leaves the member empty when no account belongs to a member', async () => {
    const { client } = fakeClient();
    const prefill = await loadAcquisitionPrefill(
      client as never,
      'http://strapi',
      'tx-leg',
    );
    expect(prefill).not.toHaveProperty('responsible_member');
  });

  it('subtracts the other linked assets, excluding the edited one', async () => {
    const { client, seen } = fakeClient({
      linkedAssets: [
        {
          documentId: 'a1',
          purchase_price: 5000,
          acquisition_transaction: { documentId: 'tx-leg' },
        },
        {
          documentId: 'self',
          purchase_price: 2878,
          acquisition_transaction: { documentId: 'tx-leg' },
        },
      ],
    });
    const prefill = await loadAcquisitionPrefill(
      client as never,
      'http://strapi',
      'tx-leg',
      'self',
    );
    expect(prefill.purchase_price).toBe(2878);
    expect(
      seen.some((u) => u.includes('filters[acquisition_transaction]')),
    ).toBe(true);
  });

  it('returns nothing for an unknown transaction', async () => {
    const client = async () => ({ json: { data: null } });
    await expect(
      loadAcquisitionPrefill(client as never, 'http://strapi', 'missing'),
    ).resolves.toEqual({});
  });
});
