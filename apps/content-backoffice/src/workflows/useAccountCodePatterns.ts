import { useMemo } from 'react';

import {
  DEFAULT_ACCOUNT_CODE_PATTERNS,
  parseCodeRegex,
  type AccountCodePatterns,
} from '../data/accountCodes';
import { useBackofficeConfig } from './useBackofficeConfig';

export function useAccountCodePatterns(): AccountCodePatterns {
  const { debitCodesPattern, creditCodesPattern, ready } = useBackofficeConfig();
  return useMemo(() => {
    if (!ready) {
      return DEFAULT_ACCOUNT_CODE_PATTERNS;
    }
    return {
      debit: parseCodeRegex(debitCodesPattern, DEFAULT_ACCOUNT_CODE_PATTERNS.debit),
      credit: parseCodeRegex(
        creditCodesPattern,
        DEFAULT_ACCOUNT_CODE_PATTERNS.credit,
      ),
    };
  }, [creditCodesPattern, debitCodesPattern, ready]);
}
