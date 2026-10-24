/** Mirrors `src/member-accounts.ts` account codes (tagi / saját). */

export const MEMBER_TAG_ACCOUNT_CODE = '1101';
export const MEMBER_PRIVATE_ACCOUNT_CODE = '1001';

type MemberAccountField = 'account' | 'private_account';

const CODE_TO_FIELD: Record<string, MemberAccountField> = {
  [MEMBER_TAG_ACCOUNT_CODE]: 'account',
  [MEMBER_PRIVATE_ACCOUNT_CODE]: 'private_account',
};

/** Resolve a member account `documentId` by GL account code. */
export function memberAccountDocumentIdByCode(
  member:
    | {
        account?: { documentId?: string; code?: string | null } | null;
        private_account?: { documentId?: string; code?: string | null } | null;
      }
    | null
    | undefined,
  accountCode: string,
): string | null {
  if (!member) {
    return null;
  }
  const field = CODE_TO_FIELD[accountCode];
  if (!field) {
    return null;
  }
  const relation = field === 'account' ? member.account : member.private_account;
  const docId = relation?.documentId;
  return typeof docId === 'string' && docId ? docId : null;
}
