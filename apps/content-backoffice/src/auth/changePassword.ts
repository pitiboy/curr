import type { ContentHttpClient } from '../data/receiptDraft';

export type ChangePasswordInput = {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
};

export function changePasswordUrl(strapiUrl: string): string {
  return `${strapiUrl.replace(/\/$/, '')}/api/auth/change-password`;
}

export function changePasswordBody(
  input: ChangePasswordInput,
): ChangePasswordInput {
  return {
    currentPassword: input.currentPassword,
    password: input.password,
    passwordConfirmation: input.passwordConfirmation,
  };
}

export async function changePassword(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: ChangePasswordInput,
): Promise<void> {
  await httpClient(changePasswordUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify(changePasswordBody(input)),
  });
}
