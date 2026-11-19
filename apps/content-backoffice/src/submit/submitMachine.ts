import { assign, fromPromise, setup } from 'xstate';

/**
 * One-shot submit guard for buttons that write to the API (convert, finalize,
 * receipt upload…). The state lives in an XState actor, so a second SUBMIT is
 * dropped synchronously — unlike React `useState`, which a fast double tap can
 * outrun before the re-render disables the button.
 *
 * idle ──SUBMIT──▶ submitting ──done──▶ idle | succeeded (lockOnSuccess)
 *                       └──────error──▶ idle
 * succeeded ──RESET──▶ idle
 */
export type SubmitMachineInput = {
  /** Stay in `succeeded` after a successful run (e.g. before a redirect). */
  lockOnSuccess?: boolean;
};

export type SubmitMachineContext = {
  lockOnSuccess: boolean;
  error: unknown;
};

/** The write to run; supplied per SUBMIT so the machine itself stays static. */
export type SubmitTask = () => Promise<unknown>;

export type SubmitMachineEvent =
  { type: 'SUBMIT'; task: SubmitTask } | { type: 'RESET' };

export const submitMachine = setup({
  types: {
    context: {} as SubmitMachineContext,
    events: {} as SubmitMachineEvent,
    input: {} as SubmitMachineInput,
  },
  actors: {
    run: fromPromise<unknown, SubmitTask | null>(({ input }) =>
      input ? input() : Promise.resolve(undefined),
    ),
  },
  guards: {
    lockOnSuccess: ({ context }) => context.lockOnSuccess,
  },
}).createMachine({
  id: 'submit',
  context: ({ input }) => ({
    lockOnSuccess: input?.lockOnSuccess === true,
    error: null,
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        SUBMIT: 'submitting',
      },
    },
    submitting: {
      entry: assign({ error: null }),
      invoke: {
        src: 'run',
        input: ({ event }) => (event.type === 'SUBMIT' ? event.task : null),
        onDone: [
          { guard: 'lockOnSuccess', target: 'succeeded' },
          { target: 'idle' },
        ],
        onError: {
          target: 'idle',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
      // SUBMIT is intentionally not handled here: duplicates are dropped.
    },
    succeeded: {
      on: {
        RESET: 'idle',
      },
    },
  },
});
