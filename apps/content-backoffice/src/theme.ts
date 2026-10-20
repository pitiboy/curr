import type { PaletteMode, SxProps, Theme, ThemeOptions } from '@mui/material/styles';
import type { SxProps as UntypedSx, SystemStyleObject } from '@mui/system';
import { deepmerge } from '@mui/utils';
import { defaultDarkTheme, defaultLightTheme } from 'react-admin';

/** Navbar green on https://zoldeletprogram.hu/ (rgb 52, 108, 62). */
const brandGreen = '#346C3E';

/** Lifted brand green so text and icons stay readable on the dark surface. */
const brandGreenOnDark = '#89A98F';

/** Faint sage and sand so consecutive rows stay easy to scan. */
const band = {
  light: ['#FAFDFC', '#FFFDFB'],
  dark: ['rgba(137, 169, 143, 0.18)', 'rgba(212, 190, 150, 0.16)'],
} as const;

export function bandColor(mode: PaletteMode, index: number): string {
  return band[mode][Math.abs(index) % 2];
}

function childBands(theme: Theme) {
  return {
    '& > :nth-of-type(odd)': { backgroundColor: bandColor(theme.palette.mode, 0) },
    '& > :nth-of-type(even)': { backgroundColor: bandColor(theme.palette.mode, 1) },
  };
}

/**
 * Mark a direct child of a banded form or show stack so it keeps the full
 * width when the stack is two columns.
 */
export const bandedSpanClass = 'banded-span';

/**
 * From `md` the stack is two columns, so a row's two cells share a color.
 * A full-width cell sits on its own row: when it lands on an even slot it
 * takes the next stripe instead of its pair partner's color.
 */
function rowPairBands(theme: Theme) {
  const sage = bandColor(theme.palette.mode, 0);
  const sand = bandColor(theme.palette.mode, 1);
  return {
    [theme.breakpoints.up('md')]: {
      // Extra :nth-of-type(n) outranks the one-column odd/even stripe.
      '& > :nth-of-type(4n+1):nth-of-type(n), & > :nth-of-type(4n+2):nth-of-type(n)':
        {
          backgroundColor: sage,
        },
      '& > :nth-of-type(4n+3):nth-of-type(n), & > :nth-of-type(4n+4):nth-of-type(n)':
        {
          backgroundColor: sand,
        },
      [`& > .${bandedSpanClass}:nth-of-type(4n+2)`]: {
        backgroundColor: sand,
      },
      [`& > .${bandedSpanClass}:nth-of-type(4n+4)`]: {
        backgroundColor: sage,
      },
    },
  };
}

/** Direct children alternate sage and sand. Spread into the parent's styles. */
export function withBands(styles: SystemStyleObject<Theme> = {}) {
  return (theme: Theme) => ({
    ...styles,
    ...childBands(theme),
  });
}

/** One row, when the parent cannot own the stripe. */
export function bandedRow(_record: unknown, index: number): UntypedSx {
  return ((theme: Theme) => ({
    backgroundColor: bandColor(theme.palette.mode, index),
  })) as UntypedSx;
}

/** Form and show fields sit in a stack; that stack owns the stripe. */
function bandedStack(theme: Theme) {
  const desktop = theme.breakpoints.up('md');
  return {
    // `&&` beats the Stack root's own `display: flex`.
    '&& > .MuiStack-root': {
      alignItems: 'stretch',
      display: 'grid',
      gap: 0.5,
      gridTemplateColumns: 'minmax(0, 1fr)',
      width: '100%',
      '& > *': {
        borderRadius: 1,
        boxSizing: 'border-box',
        m: 0,
        maxWidth: '100%',
        minWidth: 0,
        px: 1,
        py: 0.5,
        width: '100%',
      },
      '& .MuiFormControl-root': {
        m: 0,
      },
      // Empty helper text still reserves a line under every input.
      '& .MuiFormHelperText-root:not(.Mui-error)': {
        display: 'none',
      },
      ...childBands(theme),
      [desktop]: {
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        [`& > .${bandedSpanClass}`]: {
          gridColumn: '1 / -1',
        },
        ...rowPairBands(theme)[desktop],
      },
    },
  };
}

export const bandedForm: SxProps<Theme> = (theme) => ({
  ...bandedStack(theme),
  padding: theme.spacing(1),
  '&:last-child': {
    paddingBottom: theme.spacing(1),
  },
});

/**
 * SimpleShowLayout rows are inline, so the shared stripe also stretches them.
 * Pass spacing={0}: the layout's own stack spacing would add a second gap.
 */
export const bandedShow: SxProps<Theme> = (theme) => ({
  ...bandedStack(theme),
  padding: theme.spacing(0.5, 1),
  '& > .MuiStack-root > .RaSimpleShowLayout-row': {
    display: 'flex',
    flexDirection: 'column',
    mb: 0,
  },
});

/** iPhone-sized viewports: keep chrome on-screen; only the datagrid scrolls sideways. */
const mobileChrome: ThemeOptions = {
  components: {
    RaLayout: {
      styleOverrides: {
        root: {
          minWidth: 0,
          [`& .RaLayout-content`]: {
            maxWidth: '100%',
            minWidth: 0,
            overflow: 'hidden',
          },
        },
      },
    },
    RaList: {
      styleOverrides: {
        root: {
          maxWidth: '100%',
          minWidth: 0,
          [`& .RaList-main`]: {
            maxWidth: '100%',
            minWidth: 0,
          },
          [`& .RaList-content`]: {
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          },
          [`& .MuiTablePagination-root`]: {
            boxSizing: 'border-box',
            maxWidth: '100%',
            width: '100%',
          },
        },
      },
    },
    RaListToolbar: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxSizing: 'border-box',
          maxWidth: '100%',
          [theme.breakpoints.down('sm')]: {
            alignItems: 'stretch',
            flexDirection: 'column',
          },
        }),
      },
    },
    RaAppBar: {
      styleOverrides: {
        toolbar: ({ theme }) => ({
          flexWrap: 'nowrap',
          gap: theme.spacing(0.25),
          [theme.breakpoints.down('sm')]: {
            '& .MuiButton-root': {
              minWidth: 0,
              px: 0.75,
            },
          },
        }),
      },
    },
  },
};

const readableButtons: ThemeOptions = {
  components: {
    MuiAppBar: {
      defaultProps: {
        enableColorOnDark: true,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' },
      },
    },
    RaLogin: {
      styleOverrides: {
        root: {
          backgroundImage:
            'radial-gradient(circle at 50% 14em, #346C3E 0%, #1C3B22 60%, #132917 100%)',
          '& .RaLogin-icon': {
            backgroundColor: brandGreen,
            color: '#ffffff',
          },
        },
      },
    },
  },
};

const brandSecondary = {
  main: brandGreen,
  light: '#5C8964',
  dark: '#244B2B',
  contrastText: '#ffffff',
  // Login avatar reads palette.secondary[500], which augmentColor does not fill.
  500: brandGreen,
};

export const lightTheme = deepmerge(
  defaultLightTheme,
  deepmerge(mobileChrome, deepmerge(readableButtons, {
    palette: {
      primary: { main: brandGreen },
      secondary: brandSecondary,
    },
  })),
);

export const darkTheme = deepmerge(
  defaultDarkTheme,
  deepmerge(mobileChrome, deepmerge(readableButtons, {
    palette: {
      primary: { main: brandGreenOnDark },
      secondary: brandSecondary,
    },
  })),
);
