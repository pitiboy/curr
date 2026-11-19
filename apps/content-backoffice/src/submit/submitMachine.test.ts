import { describe, expect, it } from 'vitest';
import { createActor, waitFor } from 'xstate';

import { submitMachine } from './submitMachine';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('submitMachine', () => {
  it('drops a second SUBMIT while the first run is in flight', async () => {
    const actor = createActor(submitMachine, { input: {} }).start();
    const first = deferred();
    let calls = 0;
    const task = () => {
      calls += 1;
      return first.promise;
    };

    actor.send({ type: 'SUBMIT', task });
    actor.send({ type: 'SUBMIT', task });
    expect(actor.getSnapshot().value).toBe('submitting');
    expect(calls).toBe(1);

    first.resolve();
    await waitFor(actor, (snapshot) => snapshot.matches('idle'));
    expect(calls).toBe(1);
  });

  it('returns to idle after an error so the user can retry', async () => {
    const actor = createActor(submitMachine, { input: {} }).start();
    actor.send({ type: 'SUBMIT', task: () => Promise.reject(new Error('x')) });
    const snapshot = await waitFor(actor, (s) => s.matches('idle'));
    expect((snapshot.context.error as Error).message).toBe('x');
  });

  it('stays locked after success with lockOnSuccess until RESET', async () => {
    const actor = createActor(submitMachine, {
      input: { lockOnSuccess: true },
    }).start();
    let calls = 0;
    const task = async () => {
      calls += 1;
    };

    actor.send({ type: 'SUBMIT', task });
    await waitFor(actor, (snapshot) => snapshot.matches('succeeded'));
    actor.send({ type: 'SUBMIT', task });
    expect(actor.getSnapshot().value).toBe('succeeded');
    expect(calls).toBe(1);

    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('idle');
  });
});
