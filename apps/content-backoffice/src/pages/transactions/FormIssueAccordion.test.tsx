import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormIssueAccordion } from './FormIssueAccordion';

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate:
      () => (key: string, options?: { errors?: number; warnings?: number }) => {
        if (key === 'app.form_issues_count') {
          return `${options?.errors ?? 0} hiba, ${options?.warnings ?? 0} figyelmeztetés`;
        }
        return key;
      },
  };
});

describe('FormIssueAccordion', () => {
  afterEach(() => cleanup());

  it('uses yellow icon when only warnings are present', () => {
    render(
      <FormIssueAccordion
        hint="Hint"
        issues={[{ level: 'warning', message: 'Nincs bizonylat.' }]}
        title="Mentés"
      />,
    );
    expect(
      screen.getByRole('button', { name: /Mentés.*0 hiba, 1 figyelmeztetés/ }),
    ).toBeVisible();
    expect(screen.getByTestId('WarningAmberIcon')).toHaveStyle({
      color: 'rgb(249, 168, 37)',
    });
  });

  it('uses red icon when any error is present', async () => {
    const user = userEvent.setup();
    render(
      <FormIssueAccordion
        hint="Hint"
        issues={[
          { level: 'error', message: 'Saját rögzítés.' },
          { level: 'warning', message: 'Nincs bizonylat.' },
        ]}
        title="Véglegesítés"
      />,
    );
    const toggle = screen.getByRole('button', {
      name: /Véglegesítés.*1 hiba, 1 figyelmeztetés/,
    });
    expect(screen.getByTestId('WarningAmberIcon')).toHaveStyle({
      color: 'rgb(211, 47, 47)',
    });
    expect(screen.getByText('Hint')).not.toBeVisible();
    await user.click(toggle);
    expect(screen.getByText('Hint')).toBeVisible();
    expect(screen.getByText('Saját rögzítés.')).toBeVisible();
  });
});
