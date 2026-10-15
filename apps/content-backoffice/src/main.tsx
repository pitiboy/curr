import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import {
  completeGoogleLoginFromWindow,
  rememberGoogleLoginError,
} from './auth/googleLogin';

async function bootstrap() {
  try {
    await completeGoogleLoginFromWindow(window.location, window.history);
  } catch {
    rememberGoogleLoginError();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
