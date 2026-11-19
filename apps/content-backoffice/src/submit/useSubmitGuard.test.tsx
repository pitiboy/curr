import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSubmitGuard, type SubmitGuardOptions } from './useSubmitGuard';

function GuardedButton(props: SubmitGuardOptions<string, string>) {
  const guard = useSubmitGuard(props);
  return (
    <>
      {/* Not disabled on purpose: the guard must hold even when the DOM lags. */}
      <button type="button" onClick={() => guard.submit('payload')}>
        save
      </button>
      <span data-testid="state">
        {guard.submitting ? 'submitting' : guard.succeeded ? 'done' : 'idle'}
      </span>
      <button type="button" onClick={guard.reset}>
        reset
      </button>
    </>
  );
}

afterEach(cleanup);

describe('useSubmitGuard', () => {
  it('runs once on a double click', async () => {
    let resolve!: (value: string) => void;
    const run = vi.fn(
      () =>
        new Promise<string>((res) => {
          resolve = res;
        }),
    );
    const onSuccess = vi.fn();
    render(<GuardedButton run={run} onSuccess={onSuccess} />);

    const button = screen.getByRole('button', { name: 'save' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('payload');
    expect(screen.getByTestId('state').textContent).toBe('submitting');

    await act(async () => resolve('ok'));
    expect(onSuccess).toHaveBeenCalledWith('ok', 'payload');
    expect(screen.getByTestId('state').textContent).toBe('idle');

    fireEvent.click(button);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('allows a retry after failure and reports the error', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const onError = vi.fn();
    render(<GuardedButton run={run} onError={onError} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('state').textContent).toBe('idle');

    run.mockResolvedValueOnce('ok');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps the guard closed after success with lockOnSuccess', async () => {
    const run = vi.fn().mockResolvedValue('ok');
    render(<GuardedButton lockOnSuccess run={run} />);
    const button = screen.getByRole('button', { name: 'save' });

    await act(async () => fireEvent.click(button));
    await act(async () => fireEvent.click(button));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('state').textContent).toBe('done');

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    await act(async () => fireEvent.click(button));
    expect(run).toHaveBeenCalledTimes(2);
  });
});
