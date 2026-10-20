import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { memberIdentifierBase, uniqueMemberIdentifier } from './member-identifier.ts';

describe('memberIdentifierBase', () => {
  it('keeps Hungarian accents and joins words with dots', () => {
    assert.equal(memberIdentifierBase('Kovács Erika'), 'kovács.erika');
    assert.equal(memberIdentifierBase('Őri Ödön Űrhajós'), 'őri.ödön.űrhajós');
  });

  it('normalises decomposed accents to the same identifier', () => {
    assert.equal(memberIdentifierBase('Kova\u0301cs Erika'), 'kovács.erika');
  });

  it('collapses separators and trims them', () => {
    assert.equal(memberIdentifierBase('  Dr. Nagy-Szabó   Pál! '), 'dr.nagy.szabó.pál');
  });

  it('drops accents that are not Hungarian', () => {
    assert.equal(memberIdentifierBase('Müller Jürgen Çelik'), 'müller.jürgen.celik');
    assert.equal(memberIdentifierBase('Anaïs'), 'anais');
  });

  it('matches the member schema regex', () => {
    const regex = /^[áéíóőúüűöüűa-z0-9\-.]+$/;
    for (const name of ['Kovács Erika', 'Dr. Nagy-Szabó Pál', 'Anaïs 2']) {
      assert.match(memberIdentifierBase(name), regex);
    }
  });
});

describe('uniqueMemberIdentifier', () => {
  it('returns the base when free, else the next numbered one', () => {
    assert.equal(uniqueMemberIdentifier('kovács.erika', []), 'kovács.erika');
    assert.equal(
      uniqueMemberIdentifier('kovács.erika', ['kovács.erika', 'kovács.erika-2']),
      'kovács.erika-3',
    );
  });
});
