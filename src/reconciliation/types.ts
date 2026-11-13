export const RECONCILIATION_ITEM_CAP = 50;

export const CONTENT_USER_ROLE_TYPES = [
  'dataentry',
  'editor',
  'controller',
] as const;

export type ContentUserRoleType = (typeof CONTENT_USER_ROLE_TYPES)[number];

export type ReconciliationDrilldown =
  'draftTransactions' | 'publishedWithoutReceipts';

export type ReconciliationItem = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ReconciliationSection = {
  key: string;
  count: number;
  items: ReconciliationItem[];
  capped: boolean;
  drilldown?: ReconciliationDrilldown;
};

export type ReconciliationReport = {
  generatedAt: string;
  auditLogRetentionDays: number;
  sections: ReconciliationSection[];
};
