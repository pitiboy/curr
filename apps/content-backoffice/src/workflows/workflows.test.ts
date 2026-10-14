import { describe, expect, it } from 'vitest';

import {
  KNOWN_BACKOFFICE_WORKFLOWS,
  selectWorkflows,
} from '../../../../src/api/backoffice/workflows';
import {
  effectiveWorkflows,
  parseWorkflowOverride,
  visibleWorkflowForms,
} from './effectiveWorkflows';
import { userMenuEntries } from './userMenuEntries';

describe('selectWorkflows', () => {
  it('ships with an empty known list, so env tokens stay hidden', () => {
    expect(KNOWN_BACKOFFICE_WORKFLOWS).toEqual([]);
    expect(selectWorkflows('member-fee')).toEqual({
      enabled: [],
      available: [],
    });
  });

  it('keeps known ids in catalog order and drops blanks and unknowns', () => {
    expect(
      selectWorkflows(' unknown , member-fee, ,egg ', ['egg', 'member-fee']),
    ).toEqual({
      enabled: ['egg', 'member-fee'],
      available: ['egg', 'member-fee'],
    });
  });

  it('returns an empty enabled list when the env value is missing', () => {
    expect(selectWorkflows(undefined, ['member-fee'])).toEqual({
      enabled: [],
      available: ['member-fee'],
    });
  });
});

describe('effectiveWorkflows', () => {
  const enabled = ['member-fee'];
  const available = ['member-fee', 'egg'];

  it('follows the server list when there is no override', () => {
    expect(effectiveWorkflows(enabled, available, null)).toEqual(['member-fee']);
  });

  it('uses the stored list when an override is present', () => {
    expect(effectiveWorkflows(enabled, available, ['egg'])).toEqual(['egg']);
    expect(effectiveWorkflows(enabled, available, [])).toEqual([]);
  });

  it('follows the server list again after the override is cleared', () => {
    const stored = parseWorkflowOverride('["egg"]');
    expect(effectiveWorkflows(enabled, available, stored)).toEqual(['egg']);
    const cleared = parseWorkflowOverride(null);
    expect(effectiveWorkflows(enabled, available, cleared)).toEqual([
      'member-fee',
    ]);
  });

  it('drops stored ids that are not in the available list', () => {
    expect(effectiveWorkflows(enabled, available, ['egg', 'gone'])).toEqual([
      'egg',
    ]);
  });
});

describe('parseWorkflowOverride', () => {
  it('rejects malformed storage', () => {
    expect(parseWorkflowOverride('nope')).toBeNull();
    expect(parseWorkflowOverride('{"on":true}')).toBeNull();
    expect(parseWorkflowOverride('[1]')).toBeNull();
  });
});

describe('visibleWorkflowForms', () => {
  const forms = [
    { id: 'member-fee', roles: ['dataentry'] },
    { id: 'egg', roles: ['qa'] },
  ];

  it('shows the intersection of the effective list, the registry, and the role', () => {
    expect(
      visibleWorkflowForms(forms, ['member-fee', 'egg'], 'dataentry').map(
        (form) => form.id,
      ),
    ).toEqual(['member-fee']);
  });
});

describe('userMenuEntries', () => {
  it('hides the feature-flag item unless the click includes the meta key', () => {
    expect(userMenuEntries(false)).toEqual(['profile', 'logout']);
    expect(userMenuEntries(true)).toEqual([
      'profile',
      'logout',
      'feature-flags',
    ]);
  });
});
