/**
 * Napi tojás űrlap (egg-production) — backend konstansok.
 *
 * Számlák / szervezet / pénznem ugyanazok, mint a régi kliens oldali
 * mentésnél (apps/content-backoffice bulk-quantity). A KOR pénztár (1100)
 * soha nem szerepelhet egy lábon sem.
 */

/** Settings sor kulcsa: menü + szerver oldali feature flag. */
export const EGG_PRODUCTION_FEATURE_KEY = 'egg-production';

/**
 * Tyúkólak szülő szervezete; ide kerül a közös készlet és a továbbosztás.
 * Forrás: `database/seeders/egg-poultry.constants.json` (teszt ellenőrzi).
 */
export const POULTRY_STOCK_ORGANIZATION_NAME = 'Tyúktartás';

export const EGG_CURRENCY_CODE = 'EGG';
export const DEFAULT_EGG_SALE_CURRENCY_CODE = 'HUF';

/** Tojás készlet (termelés debit, továbbosztás credit). */
export const EGG_INVENTORY_ACCOUNT_CODE = '1300';
/** Tojás termelés bevétel oldala (termelés credit). */
export const EGG_PRODUCTION_REVENUE_ACCOUNT_CODE = '4500';
/** Tag saját számla (Homály) — `member.private_account`. */
export const MEMBER_PRIVATE_ACCOUNT_CODE = '1001';
/** Szövetkezeti készpénz (eladás kp befizetés). */
export const SALE_CASH_ACCOUNT_CODE = '1000';
/** Eladás bevétel. */
export const SALE_REVENUE_ACCOUNT_CODE = '4000';
/** KOR pénztár — ez az űrlap soha nem könyvelhet rá. */
export const KOR_TREASURY_ACCOUNT_CODE = '1100';

export const TRANSFER_TRANSACTION_TYPE_NAME = 'Átvezetés';
export const CASH_TRANSACTION_TYPE_NAME = 'Készpénz';

/**
 * Dedikált transaction-workflow sablonok (név szerint keresve, draft
 * státuszban seedelve — a Convert és a kliens katalógus csak published
 * sablont lát, így ezek nem zavarnak bele a Convert párosításba).
 */
export const EGG_WORKFLOW_TEMPLATE_NAMES = {
  productionPool: 'Tojás napi termelés és készlet átvezetés (űrlap)',
  distributionInternal: 'Tojás továbbosztás belső (űrlap)',
  distributionSale: 'Tojás továbbosztás eladás (űrlap)',
} as const;

export type EggWorkflowTemplateRole = keyof typeof EGG_WORKFLOW_TEMPLATE_NAMES;

/** Lépésszám sablononként (a lépések sorrendje kötött, lásd `plan.ts`). */
export const EGG_WORKFLOW_TEMPLATE_STEP_COUNT: Record<
  EggWorkflowTemplateRole,
  number
> = {
  productionPool: 3,
  distributionInternal: 1,
  distributionSale: 3,
};

/**
 * Sablon leírásban: a kifejtett lépés összege (pl. eladás bevétel Ft-ban).
 * A `{original.*}` mezőket a workflow motor tölti; ezt a szolgáltatás.
 */
export const STEP_AMOUNT_PLACEHOLDER = '{step.amount}';
