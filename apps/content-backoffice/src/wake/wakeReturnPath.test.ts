import { describe, expect, it, vi } from 'vitest';

import {
  persistWakeReturnPath,
  shouldPersistWakeReturnPath,
  WAKE_RETURN_PATH_STORAGE_KEY,
} from './wakeReturnPath';

describe('wakeReturnPath', () => {
  it('stores only backoffice paths', () => {
    expect(shouldPersistWakeReturnPath('/backoffice/')).toBe(true);
    expect(shouldPersistWakeReturnPath('/backoffice/transactions')).toBe(true);
    expect(shouldPersistWakeReturnPath('/admin')).toBe(false);
    expect(shouldPersistWakeReturnPath('/wake/')).toBe(false);
  });

  it('writes sessionStorage when allowed', () => {
    const storage: Record<string, string> = {};
    const sessionStorage = {
      setItem(key: string, value: string) {
        storage[key] = value;
      },
    };
    vi.stubGlobal('sessionStorage', sessionStorage);

    persistWakeReturnPath('/backoffice/', '?x=1', '#tab');
    expect(storage[WAKE_RETURN_PATH_STORAGE_KEY]).toBe('/backoffice/?x=1#tab');

    persistWakeReturnPath('/static/about');
    expect(storage[WAKE_RETURN_PATH_STORAGE_KEY]).toBe('/backoffice/?x=1#tab');
  });
});
