import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import TuneIcon from '@mui/icons-material/Tune';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { UserMenuContextProvider } from 'ra-core';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { AppBarProps } from 'react-admin';
import {
  AppBar,
  Logout,
  TitlePortal,
  useAuthProvider,
  useGetIdentity,
  usePermissions,
  useTranslate,
  useUserMenu,
} from 'react-admin';
import { Link } from 'react-router-dom';

import { isContentRole } from '../auth/roles';
import { APP_TITLE } from '../config';
import { userMenuEntries } from '../workflows/userMenuEntries';
import { Typography } from '@mui/material';

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

const FeatureFlagsMenuItem = forwardRef<HTMLAnchorElement>(
  function FeatureFlagsMenuItem(props, ref) {
    const translate = useTranslate();
    const { onClose } = useUserMenu();

    return (
      <MenuItem
        {...props}
        component={Link}
        onClick={onClose}
        ref={ref}
        to="/feature-flags"
      >
        <ListItemIcon>
          <TuneIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{translate('app.feature_flags')}</ListItemText>
      </MenuItem>
    );
  },
);

function UserAvatar({ alt, src }: { alt: string; src?: string }) {
  if (src) {
    return <Avatar alt={alt} src={src} sx={{ width: 24, height: 24 }} />;
  }
  return <AccountCircleIcon />;
}

function BackofficeUserMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showFeatureFlags, setShowFeatureFlags] = useState(false);
  const translate = useTranslate();
  const { isPending, identity } = useGetIdentity();
  const authProvider = useAuthProvider();
  const isLargeEnough = useMediaQuery((theme) => theme.breakpoints.up('sm'));
  const label = translate('ra.auth.user_menu', { _: 'Profile' });

  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setShowFeatureFlags(false);
  }, []);

  const handleMenu = (event: MouseEvent<HTMLElement>) => {
    setShowFeatureFlags(
      userMenuEntries(event.metaKey).includes('feature-flags'),
    );
    setAnchorEl(event.currentTarget);
  };

  const context = useMemo(() => ({ onClose: handleClose }), [handleClose]);

  if (!authProvider) {
    return null;
  }

  const open = Boolean(anchorEl);
  const avatar = (
    <UserAvatar alt={identity?.fullName ?? ''} src={identity?.avatar} />
  );

  return (
    <>
      {isLargeEnough && !isPending && identity?.fullName ? (
        <Button
          aria-label={label}
          color="inherit"
          onClick={handleMenu}
          startIcon={avatar}
          sx={{ textTransform: 'none' }}
          variant="text"
        >
          {identity.fullName}
        </Button>
      ) : (
        <Tooltip title={label}>
          <IconButton
            aria-haspopup
            aria-label={label}
            color="inherit"
            onClick={handleMenu}
          >
            {!isPending && identity?.avatar ? avatar : <AccountCircleIcon />}
          </IconButton>
        </Tooltip>
      )}
      <UserMenuContextProvider value={context}>
        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          id="menu-appbar"
          onClose={handleClose}
          open={open}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <ProfileMenuItem />
          <Logout />
          {showFeatureFlags ? <FeatureFlagsMenuItem /> : null}
        </Menu>
      </UserMenuContextProvider>
    </>
  );
}

function PageTitleSlot() {
  const [hasTitle, setHasTitle] = useState(false);

  useEffect(() => {
    const node = document.getElementById('react-admin-title');
    if (!node) {
      return;
    }

    const sync = () => {
      const next = Boolean(node.textContent?.trim());
      setHasTitle((current) => (current === next ? current : next));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {hasTitle ? (
        <span aria-hidden="true" style={{ marginInline: '0.5rem' }}>
          »
        </span>
      ) : null}
      <TitlePortal />
    </>
  );
}

export function BackofficeAppBar(props: AppBarProps) {
  return (
    <AppBar {...props} userMenu={<BackofficeUserMenu />}>
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt="Logo"
        width={32}
        height={32}
      />
      <Typography
        component="h2"
        variant="h6"
        sx={{ m: 0, fontWeight: 500, lineHeight: 1.2, pl: 1 }}
      >
        {APP_TITLE}
      </Typography>
      <PageTitleSlot />
    </AppBar>
  );
}
