export const RECONCILIATION_FEATURE_ID = 'reconciliation';

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

export type ReconciliationSectionKey =
  | 'draftTransactions'
  | 'orphanReceipts'
  | 'publishedWithoutReceipts'
  | 'membersWithoutMembership'
  | 'membershipsWithoutMembers'
  | 'membersMissingLedgerAccounts'
  | 'orphanMemberAccounts'
  | 'usersInvalidRole'
  | 'usersInactive';
