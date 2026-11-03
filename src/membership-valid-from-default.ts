/**
 * Strapi Admin create form reads `attribute.default` from the content-type
 * schema (see content-manager `createDefaultForm`). Schema JSON only allows a
 * static default, so we expose a getter that always returns "now" when the
 * admin (re)loads the membership content-type.
 */
const MEMBERSHIP_UID = 'api::membership.membership';

type StrapiForValidFromDefault = {
  contentTypes: Record<
    string,
    { attributes?: Record<string, Record<string, unknown>> }
  >;
  log: { info: (msg: string) => void };
};

export function registerMembershipValidFromFormDefault(
  strapi: StrapiForValidFromDefault,
): void {
  const attr = strapi.contentTypes[MEMBERSHIP_UID]?.attributes?.valid_from;
  if (!attr || attr.type !== 'datetime') {
    return;
  }

  Object.defineProperty(attr, 'default', {
    configurable: true,
    enumerable: true,
    get: () => new Date().toISOString(),
  });

  strapi.log.info(
    'Membership valid_from: Admin create form defaults to current datetime',
  );
}
