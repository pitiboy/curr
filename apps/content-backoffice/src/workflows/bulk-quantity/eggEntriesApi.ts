import type { ContentHttpClient } from '../../data/receiptDraft';
import type { EggConflictChoice } from './types';

/** Request body of `POST /api/egg-production/entries`. */
export type EggEntriesRequest = {
  date: string;
  productions: { organizationId: string; quantity: number }[];
  distributions: { memberId: string; quantity: number }[];
  /** Applies to every duplicate leg unless `conflictChoices` overrides it. */
  conflictChoice?: EggConflictChoice;
  /** Per coop (organizationId) or member (memberId) override. */
  conflictChoices?: Record<string, EggConflictChoice>;
  /** Auto-publish; the server honours it only when the Setting says `published`. */
  publish?: boolean;
};

export type EggLegKind =
  | 'production'
  | 'pool-coop'
  | 'pool-parent'
  | 'internal'
  | 'sale-egg'
  | 'sale-cash'
  | 'sale-revenue';

export type EggLegResult = {
  key: string;
  kind: EggLegKind;
  group: 'production' | 'distribution';
  groupKey: string;
  label: string;
  action: 'insert' | 'update' | 'skip' | 'conflict';
  status: 'planned' | 'conflict' | 'created' | 'updated' | 'skipped';
  published: boolean;
  documentId: string | null;
  existingDocumentId: string | null;
  existingAmount: number | null;
  relatedDocumentId: string | null;
  amount: number;
  description: string;
  debitCode: string | null;
  creditCode: string | null;
  currencyCode: string | null;
};

export type EggConflict = {
  key: string;
  groupKey: string;
  group: 'production' | 'distribution';
  label: string;
  kind: EggLegKind;
  amount: number;
  existingDocumentId: string;
  existingAmount: number;
};

export type EggPlanWarning = {
  code: string;
  groupKey: string;
  label: string;
  message: string;
};

export type EggEntriesResponse = {
  dryRun: boolean;
  date: string;
  autoPublish: boolean;
  anchorDocumentId: string | null;
  legs: EggLegResult[];
  conflicts: EggConflict[];
  warnings: EggPlanWarning[];
};

/** Error body of the endpoint (`error.details.code` = machine code). */
export type EggEntriesError = {
  status: number | null;
  code: string | null;
  message: string;
  conflicts: EggConflict[];
  label: string | null;
};

export function eggEntriesUrl(
  strapiUrl: string,
  path: string,
  options?: { dryRun?: boolean },
): string {
  return `${strapiUrl}${path}${options?.dryRun ? '?dryRun=1' : ''}`;
}

/** One request: the server writes every leg in one DB transaction (or none). */
export async function postEggEntries(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  path: string,
  body: EggEntriesRequest,
  options?: { dryRun?: boolean },
): Promise<EggEntriesResponse> {
  const { json } = await httpClient(eggEntriesUrl(strapiUrl, path, options), {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return (json as { data: EggEntriesResponse }).data;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads `HttpError.body.error` (ra-strapi) into a typed shape. */
export function parseEggEntriesError(error: unknown): EggEntriesError {
  const outer = record(error);
  const body = record(outer?.body);
  const inner = record(body?.error);
  const details = record(inner?.details);
  const status =
    typeof outer?.status === 'number'
      ? outer.status
      : typeof inner?.status === 'number'
        ? inner.status
        : null;
  const message =
    (typeof inner?.message === 'string' && inner.message.trim()) ||
    (error instanceof Error ? error.message : '') ||
    '';
  return {
    status,
    code: typeof details?.code === 'string' ? details.code : null,
    message,
    conflicts: Array.isArray(details?.conflicts)
      ? (details.conflicts as EggConflict[])
      : [],
    label: typeof details?.label === 'string' ? details.label : null,
  };
}

export const EGG_CONFLICT_CHOICE_REQUIRED = 'EGG_CONFLICT_CHOICE_REQUIRED';

export type EggRowSummary = {
  groupKey: string;
  group: 'production' | 'distribution';
  label: string;
  created: number;
  updated: number;
  skipped: number;
  published: boolean;
};

/** One UI row per coop / member from the leg results (order kept). */
export function summarizeEggEntries(
  response: Pick<EggEntriesResponse, 'legs'>,
): EggRowSummary[] {
  const rows = new Map<string, EggRowSummary>();
  for (const leg of response.legs) {
    const id = `${leg.group}:${leg.groupKey}`;
    let row = rows.get(id);
    if (!row) {
      row = {
        groupKey: leg.groupKey,
        group: leg.group,
        label: leg.label,
        created: 0,
        updated: 0,
        skipped: 0,
        published: false,
      };
      rows.set(id, row);
    }
    if (leg.status === 'created') row.created += 1;
    if (leg.status === 'updated') row.updated += 1;
    if (leg.status === 'skipped') row.skipped += 1;
    if (leg.published) row.published = true;
  }
  return [...rows.values()];
}

/** Conflicts grouped per coop / member for the per-row dialog. */
export function conflictGroups(conflicts: readonly EggConflict[]): {
  groupKey: string;
  label: string;
  existingAmount: number;
  amount: number;
}[] {
  const out = new Map<
    string,
    { groupKey: string; label: string; existingAmount: number; amount: number }
  >();
  for (const conflict of conflicts) {
    if (out.has(conflict.groupKey)) continue;
    out.set(conflict.groupKey, {
      groupKey: conflict.groupKey,
      label: conflict.label,
      existingAmount: conflict.existingAmount,
      amount: conflict.amount,
    });
  }
  return [...out.values()];
}
