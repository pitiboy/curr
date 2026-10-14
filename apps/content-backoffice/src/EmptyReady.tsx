import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { LocalesMenuButton, useTranslate } from 'react-admin';

export const EmptyReady = () => {
  const translate = useTranslate();

  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            {translate('app.title')}
          </Typography>
          <LocalesMenuButton />
        </Toolbar>
      </AppBar>
      <Typography variant="h5" component="h2" sx={{ p: 3 }}>
        {translate('ra.page.dashboard')}
      </Typography>
      <Typography sx={{ px: 3 }} color="text.secondary">
        {translate('app.empty_hint')}
      </Typography>
    </>
  );
};
