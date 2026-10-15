import { strapiAuthProvider, strapiHttpClient } from 'ra-strapi';
import type { AuthProvider, UserIdentity } from 'react-admin';

import { STRAPI_URL } from '../config';

type StrapiMeResponse = {
  id: number;
  username?: string;
  email?: string;
  provider?: string;
  role?: { type?: string };
};

const storage = localStorage;

const innerAuthProvider = strapiAuthProvider({
  baseURL: STRAPI_URL,
  storage,
});

export const httpClient = strapiHttpClient({ storage });

async function fetchCurrentUser(): Promise<StrapiMeResponse> {
  const { json } = await httpClient(
    `${STRAPI_URL}/api/users/me?populate=role`,
  );
  return json as StrapiMeResponse;
}

export const authProvider: AuthProvider = {
  ...innerAuthProvider,
  getIdentity: async (): Promise<UserIdentity> => {
    const user = await fetchCurrentUser();
    return {
      id: user.id,
      fullName: user.username || user.email || String(user.id),
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
  provider: string | null;
}> {
  const user = await fetchCurrentUser();
  return {
    name: user.username || '—',
    email: user.email || '—',
    provider: user.provider ?? null,
  };
}
