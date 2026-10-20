import LanguageIcon from '@mui/icons-material/Language';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { useLocaleState, useLocales, useTranslate } from 'react-admin';
import { LoadingIndicator, LocalesMenuButton, ToggleThemeButton } from 'react-admin';
import { useState, type MouseEvent } from 'react';
function CompactLocalesMenuButton() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const languages = useLocales();
  const [locale, setLocale] = useLocaleState();
  const translate = useTranslate();
  const label = translate('ra.action.select_locale', { _: 'Change language' });

  const changeLocale = (next: string) => () => {
    setLocale(next);
    setAnchorEl(null);
  };

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-controls={anchorEl ? 'locale-menu' : undefined}
          aria-haspopup="true"
          aria-label={label}
          color="inherit"
          onClick={handleOpen}
          size="small"
        >
          <LanguageIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        id="locale-menu"
        onClose={() => setAnchorEl(null)}
        open={Boolean(anchorEl)}
      >
        {languages.map((language) => (
          <MenuItem
            key={language.locale}
            onClick={changeLocale(language.locale)}
            selected={language.locale === locale}
          >
            {language.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** App bar tools: compact locale control on phone-sized viewports. */
export function BackofficeAppBarToolbar() {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const locales = useLocales();

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexShrink: 0,
        // Titles (and their flex spacer) leave the bar on small screens.
        marginLeft: isMobile ? 'auto' : undefined,
      }}
    >
      {locales && locales.length > 1 ? (
        isMobile ? <CompactLocalesMenuButton /> : <LocalesMenuButton icon={<LanguageIcon />} />
      ) : null}
      <ToggleThemeButton />
      <LoadingIndicator />
    </Box>
  );
}
