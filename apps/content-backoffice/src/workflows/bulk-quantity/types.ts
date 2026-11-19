import type { ContentRole } from '../../auth/roles';

export type BulkQuantityDistributionConfig = {
  /** Organization whose memberships define distribution rows. */
  memberOrganizationName: string;
};

export type BulkQuantityWorkflowConfig = {
  workflowId: string;
  path: string;
  labelKey: string;
  /** Parent org whose direct children are the quantity rows (hen houses). */
  parentOrganizationName: string;
  /** Produced currency (rate display on the distribution step). */
  currencyCode: string;
  /** Backend endpoint that builds and writes every leg in one DB transaction. */
  entriesPath: string;
  roles: readonly ContentRole[];
  distribution?: BulkQuantityDistributionConfig;
};

export type BulkQuantityHenHouse = {
  documentId: string;
  name: string;
};

export type BulkQuantityRow = {
  organizationId: string;
  organizationName: string;
  amount: number;
};

export type DistributionMember = {
  memberId: string;
  memberName: string;
  membershipTypeName: string | null;
  membershipRules: unknown;
  membershipTypeRules: unknown;
};

/** Server conflict choice: keep existing / overwrite it / add a new row. */
export type EggConflictChoice = 'skip' | 'replace' | 'add';
