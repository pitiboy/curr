import { Box, Link, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useLocaleState, useTranslate } from 'react-admin';

import { LEGAL_PAGES, legalLocaleFor, legalPageUrl } from './legalLinks';

type LegalLinksProps = {
  sx?: SxProps<Theme>;
};

/**
 * Privacy policy and terms links in the current UI language (the app bar
 * language menu). Used on the login screen and in the layout footer.
 */
export function LegalLinks({ sx }: LegalLinksProps) {
  const translate = useTranslate();
  const [locale] = useLocaleState();
  const pageLocale = legalLocaleFor(locale);

  return (
    <Box
      component="nav"
      aria-label={translate('app.legal_nav')}
      sx={{
        columnGap: 2,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        rowGap: 0.5,
        ...sx,
      }}
    >
      {LEGAL_PAGES.map((page) => (
        <Typography key={page.slug} component="span" variant="caption">
          <Link
            color="inherit"
            href={legalPageUrl(page.slug, locale)}
            hrefLang={pageLocale}
            rel="noopener"
            target="_blank"
            underline="hover"
          >
            {translate(page.labelKey)}
          </Link>
        </Typography>
      ))}
    </Box>
  );
}

/** Footer strip under the page content, after login. */
export function LegalFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderColor: 'divider',
        borderTop: 1,
        color: 'text.secondary',
        mt: 4,
        py: 1.5,
      }}
    >
      <LegalLinks />
    </Box>
  );
}
