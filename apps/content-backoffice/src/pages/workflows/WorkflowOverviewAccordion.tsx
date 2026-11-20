import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { useTranslate } from 'react-admin';

import type { AccountChoice } from '../../data/accountCodes';
import type { ConvertPreviewRequest } from '../../data/convertPreview';
import { transactionWorkflowAdminEditUrl } from '../../data/transactionWorkflowAdminUrl';
import {
  buildWorkflowSamplePreviewInput,
  type WorkflowSampleOrganization,
} from '../../data/workflowOverviewSample';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { STRAPI_ADMIN_URL } from '../../config';
import { ConvertPreviewPanel } from '../transactions/ConvertPreviewPanel';

const accordionSx = {
  '&:before': { display: 'none' },
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  mb: 1,
  overflow: 'hidden',
} as const;

const summarySx = {
  '& .MuiAccordionSummary-content': {
    alignItems: 'center',
    gap: 1,
    my: 0.75,
  },
} as const;

export type WorkflowOverviewAccordionProps = {
  workflow: WorkflowTemplateHeader;
  expanded: boolean;
  onToggle: (documentId: string) => void;
  accounts: readonly AccountChoice[];
  sampleOrganization: WorkflowSampleOrganization | null;
  /** HUF (or other) documentId when the template has no currency_type. */
  fallbackCurrencyDocumentId?: string | null;
};

export function WorkflowOverviewAccordion({
  workflow,
  expanded,
  onToggle,
  accounts,
  sampleOrganization,
  fallbackCurrencyDocumentId = null,
}: WorkflowOverviewAccordionProps) {
  const translate = useTranslate();

  const sample = useMemo(
    () =>
      buildWorkflowSamplePreviewInput(workflow, accounts, {
        organization: sampleOrganization,
        fallbackCurrencyDocumentId,
      }),
    [accounts, fallbackCurrencyDocumentId, sampleOrganization, workflow],
  );

  const adminEditUrl = transactionWorkflowAdminEditUrl(
    STRAPI_ADMIN_URL,
    workflow.documentId,
  );

  const previewInput: ConvertPreviewRequest | null = sample.ok
    ? sample.previewInput
    : null;

  return (
    <Accordion
      disableGutters
      expanded={expanded}
      onChange={() => onToggle(workflow.documentId)}
      square={false}
      sx={accordionSx}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
        <Typography component="span" sx={{ flex: 1 }} variant="subtitle1">
          {workflow.name?.trim() || workflow.documentId}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {expanded ? (
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <Chip
                color="info"
                label={translate('app.workflow_overview.sample_badge')}
                size="small"
                variant="outlined"
              />
              {adminEditUrl ? (
                <Button
                  component="a"
                  href={adminEditUrl}
                  rel="noopener noreferrer"
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  target="_blank"
                  variant="outlined"
                >
                  {translate('app.workflow_overview.edit')}
                </Button>
              ) : null}
            </Stack>
            {sample.ok === false ? (
              <Alert severity="warning">
                {translate(
                  `app.workflow_overview.sample_error.${sample.reason}`,
                )}
              </Alert>
            ) : null}
            {previewInput ? (
              <ConvertPreviewPanel active previewInput={previewInput} />
            ) : null}
          </Stack>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
