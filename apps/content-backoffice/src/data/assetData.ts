/**
 * Asset inventory (`/api/assets`) data access. Query building is explicit so
 * the list search / sort / filter wiring is testable without ra-strapi.
 */
import type { ContentHttpClient } from './receiptDraft';
import { encodeStrapiQuery } from './transactionList';

/** Free-text search (`q`) matches any of these fields (case-insensitive). */
export const ASSET_SEARCH_FIELDS = [
  'name',
  'serial_number',
  'location',
  'notes',
] as const;

/** List column → Strapi sort path (dotted = relation attribute). */
export const ASSET_SORT_PATHS: Record<string, string> = {
  name: 'name',
  category: 'category.name',
  ownership_type: 'ownership_type',
  status: 'status',
  responsible_member: 'responsible_member.name',
  location: 'location',
  purchase_price: 'purchase_price',
  currency_type: 'currency_type.code',
  purchase_date: 'purchase_date',
  warranty_until: 'warranty_until',
  organization: 'organization.name',
  acquisition_transaction: 'acquisition_transaction.date',
  serial_number: 'serial_number',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export const DEFAULT_ASSET_SORT = { field: 'name', order: 'ASC' } as const;

const transactionRefFields = {
  fields: ['documentId', 'date', 'amount', 'description'],
  populate: { currency_type: { fields: ['code'] } },
};

export const assetPopulate = {
  category: { fields: ['documentId', 'name'] },
  currency_type: { fields: ['documentId', 'code', 'name'] },
  responsible_member: { fields: ['documentId', 'name', 'identifier'] },
  organization: { fields: ['documentId', 'name'] },
  acquisition_transaction: transactionRefFields,
  disposal_transaction: transactionRefFields,
  photo: true,
};

const RELATION_FIELDS = [
  'category',
  'currency_type',
  'responsible_member',
  'organization',
  'acquisition_transaction',
  'disposal_transaction',
] as const;

type RelationField = (typeof RELATION_FIELDS)[number];

export type AssetTransactionRef = {
  documentId: string;
  date?: string | null;
  amount?: string | number | null;
  description?: string | null;
  currencyCode?: string | null;
};

export type AssetPhoto = {
  id: number | string;
  url: string;
  thumbnailUrl: string;
  name?: string | null;
  /** `src` / `title`: React Admin ImageInput preview shape (same as new uploads). */
  src: string;
  title: string;
};

export type AssetRecord = {
  id: string;
  documentId: string;
  name: string;
  ownership_type: string | null;
  status: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  warranty_until: string | null;
  location: string | null;
  serial_number: string | null;
  notes: string | null;
  photo: AssetPhoto | null;
  /** Relation documentIds (form / ReferenceInput values). */
  category: string | null;
  currency_type: string | null;
  responsible_member: string | null;
  organization: string | null;
  acquisition_transaction: string | null;
  disposal_transaction: string | null;
  /** Populated relation labels for list / show. */
  refs: {
    category: { name: string } | null;
    currency_type: { code: string; name: string | null } | null;
    responsible_member: { name: string } | null;
    organization: { name: string } | null;
    acquisition_transaction: AssetTransactionRef | null;
    disposal_transaction: AssetTransactionRef | null;
  };
};

export type AssetListParams = {
  filter?: Record<string, unknown>;
  sort?: { field?: string; order?: string };
  pagination?: { page?: number; perPage?: number };
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function stringList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => nonEmptyString(item))
    .filter((item): item is string => item != null);
}

function equalsOrIn(values: string[]): Record<string, unknown> {
  return values.length === 1 ? { $eq: values[0] } : { $in: values };
}

/** Strapi `filters` for the asset list (search + column filters). */
export function buildAssetFilters(
  filter: Record<string, unknown> = {},
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  const q = nonEmptyString(filter.q);
  if (q) {
    and.push({
      $or: ASSET_SEARCH_FIELDS.map((field) => ({
        [field]: { $containsi: q },
      })),
    });
  }
  for (const field of ['ownership_type', 'status'] as const) {
    const values = stringList(filter[field]);
    if (values.length > 0) and.push({ [field]: equalsOrIn(values) });
  }
  for (const field of ['category', 'organization'] as const) {
    const values = stringList(filter[field]);
    if (values.length > 0) {
      and.push({ [field]: { documentId: equalsOrIn(values) } });
    }
  }
  if (filter.has_photo === true)
    and.push({ photo: { id: { $notNull: true } } });
  if (and.length === 0) return {};
  return and.length === 1 ? and[0]! : { $and: and };
}

/** `category.name` + `asc` → `{ category: { name: 'asc' } }` (Strapi nested sort). */
export function buildAssetSort(sort?: {
  field?: string;
  order?: string;
}): Record<string, unknown>[] {
  const field =
    sort?.field && ASSET_SORT_PATHS[sort.field]
      ? sort.field
      : DEFAULT_ASSET_SORT.field;
  const direction = sort?.order === 'DESC' ? 'desc' : 'asc';
  const path = ASSET_SORT_PATHS[field]!.split('.');
  let node: unknown = direction;
  for (let i = path.length - 1; i >= 0; i -= 1) {
    node = { [path[i]!]: node };
  }
  const primary = node as Record<string, unknown>;
  // Stable paging when many rows share the sort key.
  return field === 'name' ? [primary] : [primary, { name: 'asc' }];
}

export function buildAssetListQuery(
  params: AssetListParams,
): Record<string, unknown> {
  const filters = buildAssetFilters(params.filter ?? {});
  return {
    populate: assetPopulate,
    sort: buildAssetSort(params.sort),
    pagination: {
      page: params.pagination?.page || 1,
      pageSize: params.pagination?.perPage || 25,
      withCount: true,
    },
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
  };
}

function relationDocumentId(value: unknown): string | null {
  if (typeof value === 'string') return nonEmptyString(value);
  if (value && typeof value === 'object' && 'documentId' in value) {
    return nonEmptyString((value as { documentId?: unknown }).documentId);
  }
  return null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function absoluteUrl(url: string, strapiUrl: string): string {
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = strapiUrl.replace(/\/$/, '');
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
}

function toPhoto(value: unknown, strapiUrl: string): AssetPhoto | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as {
    id?: number | string;
    url?: string;
    name?: string | null;
    formats?: Record<string, { url?: string }> | null;
  };
  if (!row.url || row.id == null) return null;
  const thumb = row.formats?.thumbnail?.url ?? row.formats?.small?.url;
  const url = absoluteUrl(row.url, strapiUrl);
  return {
    id: row.id,
    url,
    thumbnailUrl: absoluteUrl(thumb ?? row.url, strapiUrl),
    name: row.name ?? null,
    src: url,
    title: row.name ?? '',
  };
}

function toTransactionRef(value: unknown): AssetTransactionRef | null {
  const documentId = relationDocumentId(value);
  if (!documentId) return null;
  const row = value as {
    date?: string | null;
    amount?: string | number | null;
    description?: string | null;
    currency_type?: { code?: string | null } | null;
  };
  return {
    documentId,
    date: row.date ?? null,
    amount: row.amount ?? null,
    description: row.description ?? null,
    currencyCode: row.currency_type?.code ?? null,
  };
}

function nameRef(value: unknown): { name: string } | null {
  if (!value || typeof value !== 'object') return null;
  const name = nonEmptyString((value as { name?: unknown }).name);
  return name ? { name } : null;
}

/** Strapi row → React Admin record (`id` = documentId). */
export function toAssetRecord(
  raw: Record<string, unknown>,
  strapiUrl = '',
): AssetRecord {
  const documentId = String(raw.documentId ?? raw.id ?? '');
  const currency = raw.currency_type as
    { code?: string | null; name?: string | null } | null | undefined;
  const relationIds = Object.fromEntries(
    RELATION_FIELDS.map((field) => [field, relationDocumentId(raw[field])]),
  ) as Record<RelationField, string | null>;
  return {
    id: documentId,
    documentId,
    name: typeof raw.name === 'string' ? raw.name : '',
    ownership_type: nonEmptyString(raw.ownership_type),
    status: nonEmptyString(raw.status),
    purchase_price: toNumberOrNull(raw.purchase_price),
    purchase_date: nonEmptyString(raw.purchase_date),
    warranty_until: nonEmptyString(raw.warranty_until),
    location: nonEmptyString(raw.location),
    serial_number: nonEmptyString(raw.serial_number),
    notes: nonEmptyString(raw.notes),
    photo: toPhoto(raw.photo, strapiUrl),
    ...relationIds,
    refs: {
      category: nameRef(raw.category),
      currency_type:
        currency && nonEmptyString(currency.code)
          ? { code: currency.code!.trim(), name: currency.name ?? null }
          : null,
      responsible_member: nameRef(raw.responsible_member),
      organization: nameRef(raw.organization),
      acquisition_transaction: toTransactionRef(raw.acquisition_transaction),
      disposal_transaction: toTransactionRef(raw.disposal_transaction),
    },
  };
}

const SCALAR_STRING_FIELDS = ['location', 'serial_number', 'notes'] as const;
const DATE_FIELDS = ['purchase_date', 'warranty_until'] as const;

function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = nonEmptyString(value);
  return text && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

/**
 * Form values → Strapi `data`. Relations are sent as documentId strings; an
 * emptied optional relation is cleared with `{ set: [] }`. Only keys present
 * in the input are written (partial updates keep the rest).
 */
export function assetBody(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ('name' in input) body.name = nonEmptyString(input.name) ?? '';
  for (const field of ['ownership_type', 'status'] as const) {
    const value = nonEmptyString(input[field]);
    if (value) body[field] = value;
  }
  if ('purchase_price' in input) {
    body.purchase_price = toNumberOrNull(input.purchase_price);
  }
  for (const field of DATE_FIELDS) {
    if (field in input) body[field] = isoDate(input[field]);
  }
  for (const field of SCALAR_STRING_FIELDS) {
    if (field in input) body[field] = nonEmptyString(input[field]);
  }
  for (const field of RELATION_FIELDS) {
    if (!(field in input)) continue;
    const id = relationDocumentId(input[field]);
    if (id) body[field] = id;
    else if (field !== 'organization') body[field] = { set: [] };
  }
  return body;
}

type PhotoInputValue =
  { rawFile?: File; id?: number | string } | AssetPhoto | null | undefined;

/** Uploads a new image when the form holds a raw file; returns the media id to save. */
export async function resolvePhotoId(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  value: PhotoInputValue,
): Promise<number | string | null> {
  if (!value) return null;
  if ('rawFile' in value && value.rawFile instanceof File) {
    const form = new FormData();
    form.append('files', value.rawFile);
    const { json } = await httpClient(`${strapiUrl}/api/upload`, {
      method: 'POST',
      body: form,
    });
    const first = Array.isArray(json) ? json[0] : null;
    const id = (first as { id?: number | string } | null)?.id;
    if (id == null) throw new Error('The upload did not return a file id.');
    return id;
  }
  return 'id' in value && value.id != null ? value.id : null;
}

type StrapiResponse = {
  data?: Record<string, unknown> | Record<string, unknown>[];
  meta?: { pagination?: { total?: number } };
};

export async function fetchAssetList(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  params: AssetListParams,
): Promise<{ data: AssetRecord[]; total: number }> {
  const query = encodeStrapiQuery(buildAssetListQuery(params));
  const { json } = (await httpClient(`${strapiUrl}/api/assets?${query}`)) as {
    json: StrapiResponse;
  };
  const rows = Array.isArray(json.data) ? json.data : [];
  return {
    data: rows.map((row) => toAssetRecord(row, strapiUrl)),
    total: json.meta?.pagination?.total ?? rows.length,
  };
}

export async function fetchAsset(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
): Promise<AssetRecord> {
  const query = encodeStrapiQuery({ populate: assetPopulate });
  const { json } = (await httpClient(
    `${strapiUrl}/api/assets/${encodeURIComponent(documentId)}?${query}`,
  )) as { json: StrapiResponse };
  if (!json.data || Array.isArray(json.data)) {
    const missing = new Error('Not found') as Error & { status: number };
    missing.status = 404;
    throw missing;
  }
  return toAssetRecord(json.data, strapiUrl);
}

export async function fetchAssetsByIds(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  ids: readonly (string | number)[],
): Promise<AssetRecord[]> {
  if (ids.length === 0) return [];
  const query = encodeStrapiQuery({
    populate: assetPopulate,
    filters: { documentId: { $in: ids.map(String) } },
    pagination: { page: 1, pageSize: Math.max(ids.length, 1) },
  });
  const { json } = (await httpClient(`${strapiUrl}/api/assets?${query}`)) as {
    json: StrapiResponse;
  };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map((row) => toAssetRecord(row, strapiUrl));
}

export async function saveAsset(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: Record<string, unknown>,
  documentId?: string,
): Promise<AssetRecord> {
  const data = assetBody(input);
  if ('photo' in input) {
    data.photo = await resolvePhotoId(
      httpClient,
      strapiUrl,
      input.photo as PhotoInputValue,
    );
  }
  const url = documentId
    ? `${strapiUrl}/api/assets/${encodeURIComponent(documentId)}`
    : `${strapiUrl}/api/assets`;
  const { json } = (await httpClient(url, {
    method: documentId ? 'PUT' : 'POST',
    body: JSON.stringify({ data }),
  })) as { json: StrapiResponse };
  const saved = json.data && !Array.isArray(json.data) ? json.data : null;
  const savedId = String(saved?.documentId ?? documentId ?? '');
  if (!savedId) throw new Error('The asset save did not return a document.');
  return fetchAsset(httpClient, strapiUrl, savedId);
}

export async function deleteAsset(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
): Promise<void> {
  await httpClient(
    `${strapiUrl}/api/assets/${encodeURIComponent(documentId)}`,
    {
      method: 'DELETE',
    },
  );
}
