import { describe, expect, it } from 'vitest';

import { featureRolesFromConfig } from './featureRoles';

describe('featureRolesFromConfig', () => {
  it('reads trimmed string roles and ignores junk', () => {
    expect(
      featureRolesFromConfig({ roles: ['controller', '  editor ', 1, ''] }),
    ).toEqual(['controller', 'editor']);
    expect(featureRolesFromConfig({})).toEqual([]);
    expect(featureRolesFromConfig(null)).toEqual([]);
  });
});
