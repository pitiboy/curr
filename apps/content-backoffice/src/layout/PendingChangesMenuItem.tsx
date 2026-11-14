import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { Badge } from '@mui/material';
import { Menu, useTranslate } from 'react-admin';

import { usePendingChangesCount } from '../pages/pendingChanges/usePendingChangesCount';

export function PendingChangesMenuItem() {
  const translate = useTranslate();
  const count = usePendingChangesCount();
  const icon =
    count > 0 ? (
      <Badge badgeContent={count} color="warning">
        <PendingActionsIcon />
      </Badge>
    ) : (
      <PendingActionsIcon />
    );

  return (
    <Menu.Item
      leftIcon={icon}
      primaryText={translate('app.pending_changes.menu')}
      to="/pending-changes"
    />
  );
}
