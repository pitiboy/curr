import type { ContentRole } from '../../auth/roles';

export type BulkQuantityDistributionConfig = {
  /** Organization whose memberships define distribution rows. */
  memberOrganizationName: string;
};

/** Wizard (default) vs production+distribution on one page. */
export type BulkQuantityLayout = 'wizard' | 'single';

export type BulkQuantityVoiceConfig = {
  enabled: true;
  /** Settings feature key; defaults to `voice_transaction_entry`. */
  featureKey?: string;
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
  /** Default `wizard`. With `distribution`, `single` shows both sections together. */
  layout?: BulkQuantityLayout;
  /** Opt-in hangalapú kitöltés (parse-voice + workflowId). */
  voice?: BulkQuantityVoiceConfig;
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
