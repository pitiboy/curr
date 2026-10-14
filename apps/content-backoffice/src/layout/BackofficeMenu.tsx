import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ListIcon from '@mui/icons-material/List';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { Menu, usePermissions, useTranslate } from 'react-admin';

import { isContentRole } from '../auth/roles';

export function BackofficeMenu() {
  const translate = useTranslate();
  const { permissions } = usePermissions();

  return (
    <Menu>
      <Menu.Item
        leftIcon={<ListIcon />}
        primaryText={translate('app.transactions_list')}
        to="/transactions"
      />
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
      {isContentRole(permissions) && (
        <Menu.Item
          leftIcon={<AccountCircleIcon />}
          primaryText={translate('app.profile')}
          to="/profile"
        />
      )}
    </Menu>
  );
}
