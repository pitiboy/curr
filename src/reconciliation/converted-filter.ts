import { CONVERTED_EXPANDED } from '../transaction-workflow/convert';

/** Same cohort as the SPA `DEFAULT_CONVERTED_FILTER` (hide original + storno). */
export function defaultConvertedTransactionWhere(): Record<string, unknown> {
  return {
    $or: [
      { converted_to_workflow: { $null: true } },
      { converted_to_workflow: { $eq: CONVERTED_EXPANDED } },
    ],
  };
}
