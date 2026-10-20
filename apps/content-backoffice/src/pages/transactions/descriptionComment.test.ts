import { describe, expect, it } from 'vitest';

import {
  hasDescriptionComment,
  visibleDescription,
} from './descriptionComment';

const excelBlock = [
  '<!-- excel -->',
  '<!-- Excel: #2 -->',
  '<!-- Forrás: Pál -->',
  '<!-- Kinek: Pénztár -->',
  '<!-- Követel: Pál - Tagi számla -->',
  '<!-- Tartozik: Szolgáltatások -->',
  '<!-- Cél hely: Szövetkezet -->',
  '<!-- Projekt: I/4.11.1 Birtokkezelés -->',
  '<!-- Rendeltetés: Részjegy -->',
  '<!-- Művelet: Költség -->',
  '<!-- Hely: kp -->',
  '<!-- /excel -->',
].join('\n');

describe('visibleDescription', () => {
  it('keeps the description and drops the excel comment block', () => {
    const raw = `Ügyvédnek átadva munkadíj (Számla nélkül)\n\n${excelBlock}`;
    expect(visibleDescription(raw)).toBe(
      'Ügyvédnek átadva munkadíj (Számla nélkül)',
    );
  });

  it('returns empty when the description is only the comment block', () => {
    expect(visibleDescription(excelBlock)).toBe('');
    expect(visibleDescription(null)).toBe('');
    expect(visibleDescription('   \n')).toBe('');
  });

  it('keeps prose that mentions the excel marker inline', () => {
    expect(visibleDescription('jegyzet [Excel #2] a szövegben')).toBe(
      'jegyzet [Excel #2] a szövegben',
    );
    expect(visibleDescription('ár <!-- nem teljes sor --> marad')).toBe(
      'ár <!-- nem teljes sor --> marad',
    );
  });

  it('detects a full-line comment and ignores inline markers', () => {
    expect(hasDescriptionComment(`szöveg\n\n${excelBlock}`)).toBe(true);
    expect(hasDescriptionComment('jegyzet [Excel #2]')).toBe(false);
    expect(hasDescriptionComment('ár <!-- nem teljes sor --> marad')).toBe(
      false,
    );
    expect(hasDescriptionComment(null)).toBe(false);
  });

  it('drops a comment line written between two paragraphs', () => {
    expect(visibleDescription('első\n\n<!-- Excel: #9 -->\n\nmásodik')).toBe(
      'első\n\nmásodik',
    );
  });
});
