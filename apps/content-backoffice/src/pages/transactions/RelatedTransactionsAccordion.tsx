import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material';
import { useTranslate, type RaRecord } from 'react-admin';

import { RelatedTransactionsSection } from './RelatedTransactionsSection';
import {
  hasRelatedTransactionLink,
  relatedTransactionCountHint,
} from './relatedTransactions';

const accordionSx = {
  '&:before': { display: 'none' },
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  boxShadow: 'none',
  mb: 1,
  mt: 1,
} as const;

const summarySx = {
  '& .MuiAccordionSummary-content': {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 1,
    my: 0.5,
  },
} as const;

type RelatedTransactionsAccordionProps = {
  locale: string;
  locales: string;
  record: RaRecord;
};

export function RelatedTransactionsAccordion({
  locale,
  locales,
  record,
}: RelatedTransactionsAccordionProps) {
  const translate = useTranslate();
  if (!hasRelatedTransactionLink(record)) return null;

  const countHint = relatedTransactionCountHint(record);
  const title = translate('resources.transactions.fields.related_group');

  return (
    <Accordion defaultExpanded disableGutters sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
        <Typography component="span" variant="subtitle1">
          {title}
        </Typography>
        {countHint != null ? (
          <Typography color="text.secondary" component="span" variant="body2">
            {translate('app.transactions_related_children', {
              count: countHint,
            })}
          </Typography>
        ) : null}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, px: 1, pb: 1.5 }}>
        <RelatedTransactionsSection
          locale={locale}
          locales={locales}
          record={record}
        />
      </AccordionDetails>
    </Accordion>
  );
}
