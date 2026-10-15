import GoogleIcon from '@mui/icons-material/Google';
import { Box, Button } from '@mui/material';
import { useEffect } from 'react';
import {
  Login,
  LoginForm,
  PasswordInput,
  required,
  TextInput,
  useNotify,
  useTranslate,
} from 'react-admin';

import { consumeGoogleLoginError, googleConnectUrl } from '../auth/googleLogin';
import { STRAPI_URL } from '../config';
import { DocumentTitle } from '../layout/AppTitle';

export function LoginPage() {
  const translate = useTranslate();
  const notify = useNotify();

  useEffect(() => {
    if (consumeGoogleLoginError()) {
      notify('app.login_google_error', { type: 'error' });
    }
  }, [notify]);

  return (
    <Login>
      <DocumentTitle />
      <LoginForm>
        <TextInput
          autoComplete="email"
          autoFocus
          label={translate('ra.auth.email', { _: 'Email' })}
          source="email"
          type="email"
          validate={required()}
        />
        <PasswordInput
          autoComplete="current-password"
          label={translate('ra.auth.password', { _: 'Password' })}
          source="password"
          validate={required()}
        />
      </LoginForm>
      <Box sx={{ boxSizing: 'border-box', pb: 2, px: 2, width: 300 }}>
        <Button
          fullWidth
          href={googleConnectUrl(STRAPI_URL)}
          startIcon={<GoogleIcon />}
          variant="outlined"
        >
          {translate('app.login_google')}
        </Button>
      </Box>
    </Login>
  );
}
