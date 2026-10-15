import { describe, expect, it, vi } from 'vitest';

import {
  changePassword,
  changePasswordBody,
  changePasswordUrl,
} from './changePassword';

describe('changePassword', () => {
  it('posts currentPassword, password and passwordConfirmation', async () => {
    const httpClient = vi.fn(async () => ({ json: { ok: true } }));

    await changePassword(httpClient, 'http://localhost:1337', {
      currentPassword: 'old-secret',
      password: 'new-secret',
      passwordConfirmation: 'new-secret',
    });

    expect(httpClient).toHaveBeenCalledWith(
      changePasswordUrl('http://localhost:1337'),
      {
        method: 'POST',
        body: JSON.stringify(
          changePasswordBody({
            currentPassword: 'old-secret',
            password: 'new-secret',
            passwordConfirmation: 'new-secret',
          }),
        ),
      },
    );
  });
});
