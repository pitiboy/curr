import { describe, expect, it, vi } from 'vitest';

import {
  mapVoiceParseToForm,
  parseVoiceTranscript,
  parseVoiceUrl,
  type VoiceParseResult,
} from './voiceTransaction';

function result(overrides: Partial<VoiceParseResult> = {}): VoiceParseResult {
  return {
    date: '2026-11-17',
    amount: 5200,
    currency_type: 'cur-huf',
    debit_account: 'acc-5000',
    credit_account: 'acc-1000',
    organization: 'org-a',
    member: null,
    workflow: null,
    description: 'Tápvásárlás',
    confidence: 0.9,
    low_confidence_fields: [],
    warnings: [],
    labels: {},
    ...overrides,
  };
}

describe('mapVoiceParseToForm', () => {
  it('writes every non-null field immediately when no workflow is chosen', () => {
    const plan = mapVoiceParseToForm(result());
    expect(plan.immediate).toEqual({
      date: '2026-11-17',
      amount: 5200,
      currency_type: 'cur-huf',
      organization: 'org-a',
      description: 'Tápvásárlás',
      debit_account: 'acc-5000',
      credit_account: 'acc-1000',
    });
    expect(plan.afterWorkflow).toEqual({});
    expect(plan.workflowDocumentId).toBeNull();
    expect(plan.filledFields).toEqual([
      'date',
      'amount',
      'currency_type',
      'organization',
      'description',
      'debit_account',
      'credit_account',
    ]);
    expect(plan.lowConfidenceFields).toEqual([]);
  });

  it('never clears a field for a null value', () => {
    const plan = mapVoiceParseToForm(
      result({
        date: null,
        amount: null,
        organization: null,
        description: '  ',
        debit_account: null,
      }),
    );
    expect(plan.immediate).toEqual({
      currency_type: 'cur-huf',
      credit_account: 'acc-1000',
    });
    expect(plan.filledFields).toEqual(['currency_type', 'credit_account']);
  });

  it('selects the workflow and defers template-controlled fields when an account is missing', () => {
    const plan = mapVoiceParseToForm(
      result({
        debit_account: null,
        workflow: 'wf-1',
        labels: { workflow: 'Anyagvásárlás' },
      }),
    );
    expect(plan.workflowDocumentId).toBe('wf-1');
    expect(plan.workflowLabel).toBe('Anyagvásárlás');
    expect(plan.afterWorkflow).toEqual({
      currency_type: 'cur-huf',
      credit_account: 'acc-1000',
    });
    expect(plan.immediate).toEqual({
      date: '2026-11-17',
      amount: 5200,
      organization: 'org-a',
      description: 'Tápvásárlás',
    });
  });

  it('ignores the workflow when both accounts were dictated', () => {
    const plan = mapVoiceParseToForm(result({ workflow: 'wf-1' }));
    expect(plan.workflowDocumentId).toBeNull();
    expect(plan.immediate.debit_account).toBe('acc-5000');
  });

  it('flags model-reported low-confidence form fields only', () => {
    const plan = mapVoiceParseToForm(
      result({
        low_confidence_fields: ['amount', 'member', 'workflow', 'date'],
        date: null,
      }),
    );
    expect(plan.lowConfidenceFields).toEqual(['amount']);
  });

  it('flags every filled field when overall confidence is low', () => {
    const plan = mapVoiceParseToForm(result({ confidence: 0.3, amount: null }));
    expect(plan.lowConfidenceFields).toEqual(plan.filledFields);
    expect(plan.lowConfidenceFields).not.toContain('amount');
  });

  it('passes the member label and warnings through', () => {
    const plan = mapVoiceParseToForm(
      result({
        member: 'mem-peti',
        labels: { member: 'Peti' },
        warnings: ['A(z) pénznem nem azonosítható.'],
      }),
    );
    expect(plan.memberLabel).toBe('Peti');
    expect(plan.warnings).toEqual(['A(z) pénznem nem azonosítható.']);
  });
});

describe('parseVoiceTranscript', () => {
  it('posts the transcript and organization and normalizes the response', async () => {
    const httpClient = vi.fn().mockResolvedValue({
      json: { data: { ...result(), warnings: undefined, labels: undefined } },
    });
    const parsed = await parseVoiceTranscript(httpClient, 'http://api', {
      transcript: 'ötezer forint',
      organizationId: 'org-a',
    });
    expect(httpClient).toHaveBeenCalledWith(parseVoiceUrl('http://api'), {
      method: 'POST',
      body: JSON.stringify({
        transcript: 'ötezer forint',
        organizationId: 'org-a',
      }),
    });
    expect(parseVoiceUrl('http://api')).toBe(
      'http://api/api/transactions/parse-voice',
    );
    expect(parsed.warnings).toEqual([]);
    expect(parsed.labels).toEqual({});
    expect(parsed.amount).toBe(5200);
  });
});
