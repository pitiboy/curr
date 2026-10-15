import GoogleIcon from '@mui/icons-material/Google';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  Login,
  LoginForm,
  PasswordInput,
  required,
  TextInput,
  useTranslate,
} from 'react-admin';
import { useNavigate } from 'react-router-dom';

import {
  completeGoogleLoginFromSession,
  isGoogleOAuthReturn,
  startGoogleLogin,
} from '../auth/googleLogin';
import { DocumentTitle } from '../layout/AppTitle';

export function LoginPage() {
  const translate = useTranslate();
  const navigate = useNavigate();
  const [oauthBusy, setOauthBusy] = useState(() => isGoogleOAuthReturn());
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGoogleOAuthReturn()) {
      return undefined;
    }

    let active = true;
    setOauthBusy(true);
    completeGoogleLoginFromSession()
      .then((completed) => {
        if (active && completed) {
          navigate('/');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setOauthError(
            error instanceof Error ? error.message : String(error),
          );
        }
      })
      .finally(() => {
        if (active) {
          setOauthBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (oauthBusy) {
    return (
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '12rem',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Login>
      <DocumentTitle />
      {oauthError ? (
        <Box sx={{ boxSizing: 'border-box', px: 2, width: 300 }}>
          <Alert severity="error" sx={{ mb: 1 }}>
            {oauthError}
          </Alert>
        </Box>
      ) : null}
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
          startIcon={<GoogleIcon />}
          variant="outlined"
          onClick={() => startGoogleLogin()}
        >
          {translate('app.login_google')}
        </Button>
      </Box>
    </Login>
  );
}
