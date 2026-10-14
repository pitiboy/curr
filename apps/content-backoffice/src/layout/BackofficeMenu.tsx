import FactCheckIcon from '@mui/icons-material/FactCheck';
import ListIcon from '@mui/icons-material/List';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { Menu, usePermissions, useTranslate } from 'react-admin';

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
    </Menu>
  );
}
