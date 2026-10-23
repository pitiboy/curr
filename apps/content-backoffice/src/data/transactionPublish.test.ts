import { describe, expect, it } from 'vitest';

import {
  isSamePersonPublishError,
  publishTransactionDraft,
  samePersonPublishBlocked,
  strapiErrorMessage,
  transactionPublishUrl,
} from './transactionPublish';

describe('transactionPublishUrl', () => {
  it('calls the publish action and does not send status=published', () => {
    expect(transactionPublishUrl('http://localhost:1337', 'doc 1')).toBe(
      'http://localhost:1337/api/transactions/doc%201/actions/publish',
    );
  });
});

describe('publishTransactionDraft', () => {
  it('posts an empty body so the client cannot set the audit fields', async () => {
    let seen: { url: string; method?: string; body?: string } | undefined;
    await publishTransactionDraft(
      async (url, options) => {
        seen = { url, method: options?.method, body: String(options?.body) };
        return { json: { data: { documentId: 'doc-1' } } };
      },
      'http://localhost:1337',
      'doc-1',
    );
    expect(seen).toEqual({
      url: 'http://localhost:1337/api/transactions/doc-1/actions/publish',
      method: 'POST',
      body: '{}',
    });
    expect(seen?.body).not.toContain('entered_by');
    expect(seen?.body).not.toContain('published_by');
    expect(seen?.url).not.toContain('status=published');
  });
});

describe('samePersonPublishBlocked', () => {
  it('matches emails case-insensitively when policy is on', () => {
    expect(
      samePersonPublishBlocked('Editor@Example.com', 'editor@example.com', true),
    ).toBe(true);
    expect(
      samePersonPublishBlocked('other@example.com', 'editor@example.com', true),
    ).toBe(false);
    expect(
      samePersonPublishBlocked('editor@example.com', 'editor@example.com', false),
    ).toBe(false);
  });
});

describe('strapiErrorMessage', () => {
  it('reads the guard message and recognizes the same-person rejection', () => {
    const message = 'The person who entered the document cannot publish it';
    const error = {
      message: 'Forbidden',
      body: { error: { message } },
    };
    expect(strapiErrorMessage(error)).toBe(message);
    expect(isSamePersonPublishError(message)).toBe(true);
    expect(
      isSamePersonPublishError(
        'Only the editor role can publish transactions and receipts',
      ),
    ).toBe(false);
  });
});
