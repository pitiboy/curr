import {
  loadAccessibleOrganizations,
  type VoiceContextStrapi,
} from './context';
import {
  VoiceParseError,
  type VoiceActor,
  type VoiceEggParseContext,
} from './types';

const ORGANIZATION_UID = 'api::organization.organization';
const MEMBERSHIP_UID = 'api::membership.membership';

const CONTEXT_LIST_LIMIT = 500;

/** Keep in sync with `database/seeders/egg-poultry.constants.json`. */
export const EGG_POULTRY_PARENT_ORG_NAME = 'Tyúktartás';

type Row = Record<string, unknown>;

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function documentIdOf(row: unknown): string {
  return row && typeof row === 'object'
    ? str((row as { documentId?: unknown }).documentId)
    : '';
}

/** Same UTC-day window as the SPA `membershipValidOnDate`. */
export function membershipValidOnDate(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  isoDate: string,
): boolean {
  const dayStart = `${isoDate}T00:00:00.000Z`;
  const dayEnd = `${isoDate}T23:59:59.999Z`;
  if (validFrom) {
    const from = new Date(validFrom);
    if (!Number.isNaN(from.getTime()) && from.toISOString() > dayEnd) {
      return false;
    }
  }
  if (validTo) {
    const to = new Date(validTo);
    if (!Number.isNaN(to.getTime()) && to.toISOString() < dayStart) {
      return false;
    }
  }
  return true;
}

/**
 * Hen houses (children of Tyúktartás) and distribution members for egg voice.
 * Requires access to the parent poultry organization.
 */
export async function loadVoiceEggParseContext(
  strapi: VoiceContextStrapi,
  params: {
    actor: VoiceActor;
    selectedOrganizationId: string | null;
    today: string;
  },
): Promise<VoiceEggParseContext> {
  const accessible = await loadAccessibleOrganizations(strapi, params.actor);
  if (accessible.length === 0) {
    throw new VoiceParseError('Nincs elérhető szervezeted.', 403);
  }

  const parent = await strapi.db.query(ORGANIZATION_UID).findOne({
    where: { name: EGG_POULTRY_PARENT_ORG_NAME },
    select: ['documentId', 'name'],
  });
  const parentId = documentIdOf(parent);
  if (!parentId || !parent) {
    throw new VoiceParseError(
      'A tyúktartás szervezet nem található a törzsben.',
      503,
    );
  }

  if (!accessible.some((org) => org.id === parentId)) {
    throw new VoiceParseError('Ehhez a szervezethez nincs hozzáférésed.', 403);
  }

  if (
    params.selectedOrganizationId &&
    params.selectedOrganizationId !== parentId &&
    !accessible.some((org) => org.id === params.selectedOrganizationId)
  ) {
    throw new VoiceParseError('Ehhez a szervezethez nincs hozzáférésed.', 403);
  }

  const childRows = await strapi.db.query(ORGANIZATION_UID).findMany({
    where: { parent: { documentId: parentId } },
    select: ['documentId', 'name'],
    orderBy: { name: 'asc' },
    limit: CONTEXT_LIST_LIMIT,
  });

  const henHouses = childRows
    .map((row) => ({
      id: documentIdOf(row),
      name: str(row.name),
    }))
    .filter((row) => row.id && row.name);

  const membershipRows = await strapi.db.query(MEMBERSHIP_UID).findMany({
    where: { organization: { documentId: parentId } },
    select: ['documentId', 'valid_from', 'valid_to'],
    populate: { members: { select: ['documentId', 'name'] } },
    orderBy: { name: 'asc' },
    limit: CONTEXT_LIST_LIMIT,
  });

  const members: VoiceEggParseContext['members'] = [];
  const seen = new Set<string>();
  for (const row of membershipRows) {
    if (
      !membershipValidOnDate(
        str(row.valid_from) || null,
        str(row.valid_to) || null,
        params.today,
      )
    ) {
      continue;
    }
    const memberList = Array.isArray(row.members) ? (row.members as Row[]) : [];
    for (const member of memberList) {
      const id = documentIdOf(member);
      const name = str(member.name);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      members.push({ id, name });
    }
  }
  members.sort((a, b) => a.name.localeCompare(b.name, 'hu'));

  return {
    today: params.today,
    parentOrganizationId: parentId,
    parentOrganizationName: str(parent.name) || EGG_POULTRY_PARENT_ORG_NAME,
    henHouses,
    members,
  };
}
