import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ListIcon from '@mui/icons-material/List';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { Menu, usePermissions, useTranslate } from 'react-admin';

import { useBackofficeConfig } from '../workflows/useBackofficeConfig';
import { visibleWorkflowForms } from '../workflows/effectiveWorkflows';
import { workflowForms } from '../workflows/registry';

export function BackofficeMenu() {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const { effective } = useBackofficeConfig();
  const workflows = visibleWorkflowForms(
    workflowForms,
    effective,
    typeof permissions === 'string' ? permissions : '',
  );

  return (
    <Menu>
      <Menu.Item
        leftIcon={<ListIcon />}
        primaryText={translate('app.transactions_list')}
        to="/transactions"
      />
      {workflows.map((form) => (
        <Menu.Item
          key={form.id}
          leftIcon={<AccountTreeIcon />}
          primaryText={translate(form.labelKey)}
          to={form.path}
        />
      ))}
      {permissions === 'dataentry' && (
        <Menu.Item
          leftIcon={<PostAddIcon />}
          primaryText={translate('app.transactions_create')}
          to="/transactions/create"
        />
      )}
      {permissions === 'qa' && (
        <Menu.Item
          leftIcon={<FactCheckIcon />}
          primaryText={translate('app.transactions_review')}
          to="/transactions/review"
        />
      )}
    </Menu>
  );
}
