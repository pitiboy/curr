import { Box, Link, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useLocaleState, useTranslate } from 'react-admin';

import { STATIC_PAGES, staticLocaleFor, staticPageUrl } from './staticUrls';

type StaticLinksProps = {
  sx?: SxProps<Theme>;
};

/**
 * Privacy policy and terms links in the current UI language (the app bar
 * language menu). Used on the login screen and in the layout footer.
 */
export function StaticLinks({ sx }: StaticLinksProps) {
  const translate = useTranslate();
  const [locale] = useLocaleState();
  const pageLocale = staticLocaleFor(locale);

  return (
    <Box
      component="nav"
      aria-label={translate('app.static_nav')}
      sx={{
        columnGap: 2,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        rowGap: 0.5,
        ...sx,
      }}
    >
      {STATIC_PAGES.map((page) => (
        <Typography key={page.slug} component="span" variant="caption">
          <Link
            color="inherit"
            href={staticPageUrl(page.slug, locale)}
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
export function StaticFooter() {
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
      <StaticLinks />
    </Box>
  );
}
