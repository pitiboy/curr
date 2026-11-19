import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VOICE_TRANSACTION_FEATURE_KEY } from '../../data/voiceTransaction';

const parseVoiceTranscript = vi.fn();
let onFinal: ((transcript: string) => void) | null = null;

vi.mock('../../theme', () => ({
  bandedSpanClass: 'banded-span',
}));

vi.mock('ra-strapi', () => ({
  strapiHttpClient: () => vi.fn(),
}));

vi.mock('../../workflows/useBackofficeConfig', () => ({
  useBackofficeConfig: () => ({
    features: { [VOICE_TRANSACTION_FEATURE_KEY]: { enabled: true } },
  }),
}));

vi.mock('../../data/voiceTransaction', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../data/voiceTransaction')>();
  return {
    ...actual,
    parseVoiceTranscript: (...args: unknown[]) => parseVoiceTranscript(...args),
  };
});

vi.mock('./useSpeechRecognition', () => ({
  useSpeechRecognition: ({
    onFinal: next,
  }: {
    onFinal: (transcript: string) => void;
  }) => {
    onFinal = next;
    return {
      supported: true,
      listening: false,
      interim: '',
      finalText: 'kétezer forint táp',
      errorKey: null,
      start: vi.fn(),
      stop: vi.fn(),
    };
  },
}));

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string) => {
      const hu: Record<string, string> = {
        'app.voice_start': 'Diktálás',
        'app.voice_stop': 'Diktálás vége',
        'app.voice_hint': 'Mondd el magyarul a tranzakciót.',
        'app.voice_listening': 'Figyelek…',
        'app.voice_processing': 'Értelmezés…',
        'app.voice_error_request':
          'A diktálás értelmezése nem sikerült. Próbáld újra.',
        'app.voice_retry': 'Újra',
        'app.voice_review_notice': 'Az űrlapot a diktálás alapján kitöltöttük.',
        'app.voice_filled_fields': 'Kitöltve:',
        'app.voice_low_confidence': 'bizonytalan',
        'app.voice_nothing_filled':
          'A diktálásból egyetlen mezőt sem sikerült kitölteni.',
        'resources.transactions.fields.date': 'Dátum',
        'resources.transactions.fields.amount': 'Összeg',
        'resources.transactions.fields.currency_type': 'Pénznem',
        'resources.transactions.fields.organization': 'Szervezet',
        'resources.transactions.fields.description': 'Leírás',
        'resources.transactions.fields.debit_account': 'Költség számla',
        'resources.transactions.fields.credit_account': 'Kifizető számla',
      };
      return hu[key] ?? key;
    },
  };
});

import { VoiceTransactionEntry } from './VoiceTransactionEntry';

function FormShell({ children }: { children: React.ReactNode }) {
  const methods = useForm({
    defaultValues: { organization: 'org-1' },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

afterEach(() => {
  cleanup();
  parseVoiceTranscript.mockReset();
  onFinal = null;
});

describe('VoiceTransactionEntry', () => {
  it('retries parse-voice with the same transcript after a failure', async () => {
    const user = userEvent.setup();
    parseVoiceTranscript
      .mockRejectedValueOnce(
        new Error('Az értelmező most nem érhető el. Próbáld újra később.'),
      )
      .mockResolvedValueOnce({
        date: '2026-11-19',
        amount: 2000,
        currency_type: null,
        debit_account: null,
        credit_account: null,
        organization: 'org-1',
        member: null,
        workflow: null,
        description: 'táp',
        confidence: 0.9,
        low_confidence_fields: [],
        warnings: [],
        labels: {},
      });

    render(
      <FormShell>
        <VoiceTransactionEntry />
      </FormShell>,
    );

    expect(onFinal).toBeTypeOf('function');
    await onFinal!('kétezer forint táp');

    expect(
      await screen.findByText(
        'Az értelmező most nem érhető el. Próbáld újra később.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Újra' }));

    await waitFor(() => {
      expect(parseVoiceTranscript).toHaveBeenCalledTimes(2);
    });
    expect(parseVoiceTranscript).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.anything(),
      {
        transcript: 'kétezer forint táp',
        organizationId: 'org-1',
      },
    );
    expect(parseVoiceTranscript).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.anything(),
      {
        transcript: 'kétezer forint táp',
        organizationId: 'org-1',
      },
    );
    expect(
      await screen.findByText('Az űrlapot a diktálás alapján kitöltöttük.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Az értelmező most nem érhető el. Próbáld újra később.',
      ),
    ).not.toBeInTheDocument();
  });
});
