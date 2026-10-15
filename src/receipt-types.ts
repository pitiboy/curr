export const RECEIPT_TYPE_UID = 'api::receipt-type.receipt-type';

/** Lookup names. Several receipts may share one type. */
export const RECEIPT_TYPE_NAMES = [
  'Számla',
  'Előlegszámla',
  'Végszámla',
  'Módosító számla',
  'Sztornó számla',
  'Nyugta',
  'Díjbekérő',
  'Bankkivonat',
  'Bevételi pénztárbizonylat',
  'Kiadási pénztárbizonylat',
  'Szerződés',
  'Teljesítésigazolás',
  'Egyéb',
] as const;

type ReceiptTypeRow = { name?: string | null };

type ReceiptTypeApi = {
  findMany: (params?: Record<string, unknown>) => Promise<ReceiptTypeRow[]>;
  create: (params: { data: { name: string } }) => Promise<unknown>;
};

export async function ensureReceiptTypes(strapi: {
  documents: (uid: string) => ReceiptTypeApi;
  log: { info: (message: string) => void };
}) {
  const api = strapi.documents(RECEIPT_TYPE_UID);
  const existing = await api.findMany();
  const names = new Set(
    existing
      .map((row) => row.name?.trim())
      .filter((name): name is string => Boolean(name)),
  );

  for (const name of RECEIPT_TYPE_NAMES) {
    if (names.has(name)) continue;
    await api.create({ data: { name } });
    names.add(name);
    strapi.log.info(`Created receipt type "${name}"`);
  }
}
