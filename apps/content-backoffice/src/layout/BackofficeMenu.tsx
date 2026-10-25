import type { ReactNode } from 'react';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ListIcon from '@mui/icons-material/List';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { Menu, usePermissions, useTranslate } from 'react-admin';
import { useLocation } from 'react-router-dom';

import {
  transactionListMode,
  transactionsMenuTo,
  type TransactionListMode,
} from '../data/transactionListLocation';
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
  const active = transactionListMode(location.pathname, location.search) === mode;
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
