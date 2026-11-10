import { Box } from '@mui/material';
import { AutocompleteInput, ReferenceInput } from 'react-admin';

import { bandedSpanClass } from '../../theme';

function nameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  return query ? { name: { $containsi: query } } : {};
}

/**
 * Optional `transaction_type` relation (documentId string in the form).
 * Full row: the banded grid pairs fields two by two, and a lone half-width
 * field would shift every later pair.
 */
export function TransactionTypeInput() {
  return (
    <Box className={bandedSpanClass}>
      <ReferenceInput
        perPage={100}
        reference="transaction-types"
        sort={{ field: 'name', order: 'ASC' }}
        source="transaction_type"
      >
        <AutocompleteInput
          filterToQuery={nameFilterToQuery}
          fullWidth
          optionText="name"
        />
      </ReferenceInput>
    </Box>
  );
}
