import { strapiAuthProvider, strapiHttpClient } from 'ra-strapi';
import type { AuthProvider, UserIdentity } from 'react-admin';

import { STRAPI_URL } from '../config';
import { isGoogleOAuthReturn } from './googleLogin';
import { persistStrapiAuthSession } from './strapiAuthStorage';

type StrapiMeResponse = {
  id: number;
  username?: string;
  email?: string;
  provider?: string;
  role?: { type?: string; name?: string };
};

const storage = localStorage;

const innerAuthProvider = strapiAuthProvider({
  baseURL: STRAPI_URL,
  storage,
});

const httpClient = strapiHttpClient({ storage });

async function fetchCurrentUser(): Promise<StrapiMeResponse> {
  const { json } = await httpClient(`${STRAPI_URL}/api/users/me?populate=role`);
  return json as StrapiMeResponse;
}

export const authProvider: AuthProvider = {
  ...innerAuthProvider,
  checkAuth: async (params) => {
    // Google OAuth visszatéréskor a token még nincs elmentve: a LoginPage
    // fejezi be a belépést. Ilyenkor csendben irányítunk a login oldalra,
    // a "Jelentkezzen be" figyelmeztetés felvillanása nélkül.
    if (isGoogleOAuthReturn()) {
      throw { message: false };
    }
    return innerAuthProvider.checkAuth(params);
  },
  getIdentity: async (): Promise<UserIdentity> => {
    const user = await fetchCurrentUser();
    return {
      id: user.id,
      fullName: user.username || user.email || String(user.id),
      email: user.email ?? '',
    };
  },
  getPermissions: async () => {
    const user = await fetchCurrentUser();
    return user.role?.type ?? '';
  },
};

export async function fetchProfileFields(): Promise<{
  name: string;
  email: string;
  provider: string;
  roleType: string;
  roleName: string;
}> {
  const user = await fetchCurrentUser();
  return {
    name: user.username || '—',
    email: user.email || '—',
    provider: user.provider ?? 'local',
    roleType: user.role?.type ?? '',
    roleName: user.role?.name || user.role?.type || '—',
  };
}

export async function changePassword(params: {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}): Promise<void> {
  try {
    const { json } = await httpClient(
      `${STRAPI_URL}/api/auth/change-password`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
    );

    const payload = json as { jwt?: string; user?: unknown };
    if (payload.jwt && payload.user) {
      persistStrapiAuthSession(payload.jwt, payload.user);
    }
  } catch (error) {
    const body = (error as { body?: { error?: { message?: string } } }).body;
    const message = body?.error?.message;
    if (message) {
      throw new Error(message);
    }
    throw error;
  }
}
