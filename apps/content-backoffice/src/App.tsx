import { useEffect } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ListItemIcon, MenuItem } from '@mui/material';
import { deepmerge } from '@mui/utils';
import {
  Admin,
  Layout,
  Menu,
  Sidebar,
  type SidebarProps,
  Title,
  defaultDarkTheme,
  defaultLightTheme,
  useTranslate,
} from 'react-admin';

import { noopDataProvider } from './dataProvider';
import { i18nProvider } from './i18n';

const themeWithReadableButtons = {
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' as const },
      },
    },
  },
};

const lightTheme = deepmerge(defaultLightTheme, themeWithReadableButtons);
const darkTheme = deepmerge(defaultDarkTheme, themeWithReadableButtons);

/** Visible stand-in until step 3 registers a resource. Not a route. */
function EmptyMenu() {
  const translate = useTranslate();

  return (
    <Menu>
      <MenuItem disableRipple sx={{ cursor: 'default' }}>
        <ListItemIcon>
          <InfoOutlinedIcon fontSize="small" />
        </ListItemIcon>
        {translate('app.menu_placeholder')}
      </MenuItem>
    </Menu>
  );
}

function FrameSidebar(props: SidebarProps) {
  return (
    <Sidebar
      {...props}
      sx={{
        '& .MuiPaper-root': {
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    />
  );
}

/** Frame until a resource exists. The default Ready splash skips Layout and i18n. */
function EmptyFrame() {
  const translate = useTranslate();

  useEffect(() => {
    document.title = translate('app.title');
  }, [translate]);

  return (
    <Layout menu={EmptyMenu} sidebar={FrameSidebar}>
      <Title title="app.title" preferenceKey={false} />
    </Layout>
  );
}

export function App() {
  return (
    <Admin
      darkTheme={darkTheme}
      dataProvider={noopDataProvider}
      i18nProvider={i18nProvider}
      lightTheme={lightTheme}
      ready={EmptyFrame}
      requireAuth={false}
      title="app.title"
    />
  );
}
