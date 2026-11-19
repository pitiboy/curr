import { useActorRef, useSelector } from '@xstate/react';
import { useCallback, useLayoutEffect, useRef } from 'react';

import { submitMachine } from './submitMachine';

export type SubmitGuardOptions<TInput, TResult> = {
  /** The API write. Rejecting returns the guard to idle (retry allowed). */
  run: (input: TInput) => Promise<TResult>;
  onSuccess?: (result: TResult, input: TInput) => void;
  onError?: (error: unknown, input: TInput) => void;
  /** Keep the guard closed after success until `reset()` (redirect flows). */
  lockOnSuccess?: boolean;
};

export type SubmitGuard<TInput> = {
  /** Starts the run; returns false when a run is already in flight / locked. */
  submit: (input: TInput) => boolean;
  /** True while the request runs, or after success with `lockOnSuccess`. */
  busy: boolean;
  submitting: boolean;
  succeeded: boolean;
  reset: () => void;
};

/**
 * Double-submit guard backed by `submitMachine`. The actor transitions
 * synchronously on `send`, so the second of two rapid clicks is ignored even
 * before React re-renders the disabled button.
 */
export function useSubmitGuard<TInput = void, TResult = unknown>(
  options: SubmitGuardOptions<TInput, TResult>,
): SubmitGuard<TInput> {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const actorRef = useActorRef(submitMachine, {
    input: { lockOnSuccess: options.lockOnSuccess === true },
  });

  const submitting = useSelector(actorRef, (snapshot) =>
    snapshot.matches('submitting'),
  );
  const succeeded = useSelector(actorRef, (snapshot) =>
    snapshot.matches('succeeded'),
  );

  const submit = useCallback(
    (input: TInput) => {
      if (!actorRef.getSnapshot().matches('idle')) return false;
      const current = optionsRef.current;
      actorRef.send({
        type: 'SUBMIT',
        task: async () => {
          let result: TResult;
          try {
            result = await current.run(input);
          } catch (error) {
            current.onError?.(error, input);
            throw error;
          }
          current.onSuccess?.(result, input);
          return result;
        },
      });
      return true;
    },
    [actorRef],
  );

  const reset = useCallback(() => actorRef.send({ type: 'RESET' }), [actorRef]);

  return {
    submit,
    busy: submitting || succeeded,
    submitting,
    succeeded,
    reset,
  };
}
