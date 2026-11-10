import type { ReactNode } from 'react';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ListIcon from '@mui/icons-material/List';
import PostAddIcon from '@mui/icons-material/PostAdd';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import { Menu, usePermissions, useTranslate } from 'react-admin';
import { useLocation } from 'react-router-dom';

import { isContentRole, isEditorLikeRole } from '../auth/roles';
import {
  TRANSACTIONS_LIST_PATH,
  transactionListMode,
} from '../data/transactionListLocation';
import type { TransactionMenuMode } from '../filters/globalTransactionFilters';
import {
  useGlobalTransactionFilters,
  useApplyMenuOverride,
} from '../filters/globalTransactionFiltersAtom';
import { MEMBERSHIP_SHARE_FEATURE_ID } from '../pages/reports/membershipShare/types';
import { PROJECT_BALANCE_FEATURE_ID } from '../pages/reports/projectBalance/types';
import { EGG_PRODUCTION_WORKFLOW_ID } from '../workflows/bulk-quantity/eggDailyEntry.constants';
import { useBackofficeConfig } from '../workflows/useBackofficeConfig';
import { visibleWorkflowForms } from '../workflows/effectiveWorkflows';
import { workflowForms } from '../workflows/registry';

import { AdministrationMenuItem } from './AdministrationMenuItem';

export function BackofficeMenu() {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const { enabled } = useBackofficeConfig();
  const workflows = visibleWorkflowForms(
    workflowForms,
    enabled,
    typeof permissions === 'string' ? permissions : '',
  );
  const canWrite = isContentRole(permissions);
  const canReview = isEditorLikeRole(permissions);
  const canReadEggInventory =
    canWrite && enabled.includes(EGG_PRODUCTION_WORKFLOW_ID);
  const canReadMembershipShare =
    canWrite && enabled.includes(MEMBERSHIP_SHARE_FEATURE_ID);
  const canReadProjectBalance =
    canWrite && enabled.includes(PROJECT_BALANCE_FEATURE_ID);

  return (
    <Menu>
      <TransactionListMenuItem
        icon={<ListIcon />}
        label={translate('app.transactions_list')}
        mode="all"
      />
      {workflows.map((form) => (
        <Menu.Item
          key={form.id}
          leftIcon={<AccountTreeIcon />}
          primaryText={translate(form.labelKey)}
          to={form.path}
        />
      ))}
      {canWrite ? (
        <Menu.Item
          leftIcon={<PostAddIcon />}
          primaryText={translate('app.transactions_create')}
          to="/transactions/create"
        />
      ) : null}
      {canReadEggInventory ? (
        <>
          <Menu.Item
            leftIcon={<AssessmentOutlinedIcon />}
            primaryText={translate('app.egg_inventory.menu')}
            to="/reports/egg-inventory"
          />
          <Menu.Item
            leftIcon={<AssessmentOutlinedIcon />}
            primaryText={translate('app.hen_inventory.menu')}
            to="/reports/hen-inventory"
          />
        </>
      ) : null}
      {canReadMembershipShare ? (
        <Menu.Item
          leftIcon={<SavingsOutlinedIcon />}
          primaryText={translate('app.membership_share.menu')}
          to="/reports/membership-share"
        />
      ) : null}
      {canReadProjectBalance ? (
        <Menu.Item
          leftIcon={<AssessmentOutlinedIcon />}
          primaryText={translate('app.project_balance.menu')}
          to="/reports/project-balance"
        />
      ) : null}
      {canReview ? (
        <TransactionListMenuItem
          icon={<FactCheckIcon />}
          label={translate('app.transactions_review')}
          mode="draft"
        />
      ) : null}
      <AdministrationMenuItem />
    </Menu>
  );
}

function TransactionListMenuItem({
  icon,
  label,
  mode,
}: {
  icon: ReactNode;
  label: string;
  mode: TransactionMenuMode;
}) {
  const location = useLocation();
  const [filters] = useGlobalTransactionFilters();
  const applyMenuOverride = useApplyMenuOverride();
  const active =
    transactionListMode(location.pathname, filters.status) === mode;
  return (
    <Menu.Item
      leftIcon={icon}
      // Override status + converted in the global filters, keep the rest.
      onClick={() => applyMenuOverride(mode)}
      primaryText={label}
      sx={
        active
          ? undefined
          : {
              '&.RaMenuItemLink-active': {
                color: 'text.secondary',
              },
            }
      }
      to={TRANSACTIONS_LIST_PATH}
    />
  );
}
