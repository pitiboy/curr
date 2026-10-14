import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import { forwardRef } from 'react';
import type { AppBarProps } from 'react-admin';
import {
  AppBar,
  Logout,
  UserMenu,
  usePermissions,
  useTranslate,
  useUserMenu,
} from 'react-admin';
import { Link } from 'react-router-dom';

import { isContentRole } from '../auth/roles';

const ProfileMenuItem = forwardRef<HTMLAnchorElement>(
  function ProfileMenuItem(props, ref) {
    const translate = useTranslate();
    const { onClose } = useUserMenu();
    const { permissions } = usePermissions();

    if (!isContentRole(permissions)) {
      return null;
    }

    return (
      <MenuItem
        {...props}
        component={Link}
        onClick={onClose}
        ref={ref}
        to="/profile"
      >
        <ListItemIcon>
          <AccountCircleIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{translate('app.profile')}</ListItemText>
      </MenuItem>
    );
  },
);

function BackofficeUserMenu() {
  return (
    <UserMenu>
      <ProfileMenuItem />
      <Logout />
    </UserMenu>
  );
}

export function BackofficeAppBar(props: AppBarProps) {
  return <AppBar {...props} userMenu={<BackofficeUserMenu />} />;
}
