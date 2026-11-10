import type { ReactNode } from 'react';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ListIcon from '@mui/icons-material/List';
import PostAddIcon from '@mui/icons-material/PostAdd';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import { Menu, usePermissions, useTranslate } from 'react-admin';
import { useLocation } from 'react-router-dom';

import {
  transactionListMode,
  transactionsMenuTo,
  type TransactionListMode,
} from '../data/transactionListLocation';
import { MEMBERSHIP_SHARE_FEATURE_ID } from '../pages/reports/membershipShare/types';
import { PROJECT_BALANCE_FEATURE_ID } from '../pages/reports/projectBalance/types';
import { EGG_PRODUCTION_WORKFLOW_ID } from '../workflows/bulk-quantity/eggDailyEntry.constants';
import { useBackofficeConfig } from '../workflows/useBackofficeConfig';
import { visibleWorkflowForms } from '../workflows/effectiveWorkflows';
import { workflowForms } from '../workflows/registry';

export function BackofficeMenu() {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const { enabled } = useBackofficeConfig();
  const workflows = visibleWorkflowForms(
    workflowForms,
    enabled,
    typeof permissions === 'string' ? permissions : '',
  );
  const canReadReports =
    permissions === 'dataentry' || permissions === 'editor';
  const canReadEggInventory =
    canReadReports && enabled.includes(EGG_PRODUCTION_WORKFLOW_ID);
  const canReadMembershipShare =
    canReadReports && enabled.includes(MEMBERSHIP_SHARE_FEATURE_ID);
  const canReadProjectBalance =
    canReadReports && enabled.includes(PROJECT_BALANCE_FEATURE_ID);

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
      {(permissions === 'dataentry' || permissions === 'editor') && (
        <Menu.Item
          leftIcon={<PostAddIcon />}
          primaryText={translate('app.transactions_create')}
          to="/transactions/create"
        />
      )}
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
      {permissions === 'editor' && (
        <TransactionListMenuItem
          icon={<FactCheckIcon />}
          label={translate('app.transactions_review')}
          mode="draft"
        />
      )}
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
  mode: TransactionListMode;
}) {
  const location = useLocation();
  const active =
    transactionListMode(location.pathname, location.search) === mode;
  return (
    <Menu.Item
      leftIcon={icon}
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
      to={transactionsMenuTo(mode)}
    />
  );
}
