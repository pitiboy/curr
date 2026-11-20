import { CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  Title,
  useDataProvider,
  usePermissions,
  useTranslate,
} from 'react-admin';

import { TRANSACTION_WORKFLOW_PREFILL_ROLES } from '../../data/accountRowSelection';
import { loadAllAccounts, type AccountChoice } from '../../data/accountCodes';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import {
  ReportPageHeader,
  ReportPageShell,
} from '../reports/shared/reportLayout';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import type { WorkflowSampleOrganization } from '../../data/workflowOverviewSample';

import { WorkflowOverviewAccordion } from './WorkflowOverviewAccordion';

function sortWorkflows(
  workflows: WorkflowTemplateHeader[],
): WorkflowTemplateHeader[] {
  return [...workflows].sort((left, right) => {
    const nameA = left.name?.trim() || left.documentId;
    const nameB = right.name?.trim() || right.documentId;
    return nameA.localeCompare(nameB, 'hu');
  });
}

export function TransactionWorkflowsOverviewPage() {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const { permissions, isPending: permissionsPending } = usePermissions();
  const { workflows, loading: workflowsLoading } =
    useTransactionWorkflowCatalog();
  const [accounts, setAccounts] = useState<AccountChoice[] | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [sampleOrganization, setSampleOrganization] =
    useState<WorkflowSampleOrganization | null>(null);
  const [expandedId, setExpandedId] = useState<string | false>(false);

  const mayAccess =
    !permissionsPending &&
    typeof permissions === 'string' &&
    (TRANSACTION_WORKFLOW_PREFILL_ROLES as readonly string[]).includes(
      permissions,
    );

  const needsOrganization = useMemo(
    () => workflows.some((row) => row.requires_source_organization),
    [workflows],
  );

  const sortedWorkflows = useMemo(() => sortWorkflows(workflows), [workflows]);

  useEffect(() => {
    if (!mayAccess) {
      setAccounts([]);
      setAccountsLoading(false);
      return;
    }

    let cancelled = false;
    setAccountsLoading(true);

    void loadAllAccounts(dataProvider.getList)
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataProvider, mayAccess]);

  useEffect(() => {
    if (!mayAccess || !needsOrganization) {
      setSampleOrganization(null);
      return;
    }

    let cancelled = false;

    void dataProvider
      .getList('organizations', {
        pagination: { page: 1, perPage: 1 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      })
      .then((result) => {
        if (cancelled) return;
        const row = result.data?.[0] as
          | { id?: string; documentId?: string; name?: string | null }
          | undefined;
        const documentId =
          typeof row?.id === 'string'
            ? row.id
            : typeof row?.documentId === 'string'
              ? row.documentId
              : '';
        if (!documentId) {
          setSampleOrganization(null);
          return;
        }
        setSampleOrganization({
          documentId,
          name: typeof row?.name === 'string' ? row.name : null,
        });
      })
      .catch(() => {
        if (!cancelled) setSampleOrganization(null);
      });

    return () => {
      cancelled = true;
    };
  }, [dataProvider, mayAccess, needsOrganization]);

  const onToggleWorkflow = (documentId: string) => {
    setExpandedId((current) => (current === documentId ? false : documentId));
  };

  const catalogLoading =
    workflowsLoading || accountsLoading || accounts === null;

  return (
    <ReportPageShell>
      <Title title={translate('app.workflow_overview.title')} />
      <ReportPageHeader
        subtitle={translate('app.workflow_overview.subtitle')}
        title={translate('app.workflow_overview.title')}
      />
      {!mayAccess ? (
        <Typography color="text.secondary" variant="body2">
          {translate('app.workflow_overview.forbidden')}
        </Typography>
      ) : catalogLoading ? (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 4 }}>
          <CircularProgress size={36} />
          <Typography color="text.secondary" variant="body2">
            {translate('app.workflow_overview.loading')}
          </Typography>
        </Stack>
      ) : sortedWorkflows.length === 0 ? (
        <Typography color="text.secondary" variant="body1">
          {translate('app.workflow_overview.empty')}
        </Typography>
      ) : (
        <Stack spacing={0}>
          {sortedWorkflows.map((workflow) => (
            <WorkflowOverviewAccordion
              key={workflow.documentId}
              accounts={accounts ?? []}
              expanded={expandedId === workflow.documentId}
              onToggle={onToggleWorkflow}
              sampleOrganization={sampleOrganization}
              workflow={workflow}
            />
          ))}
        </Stack>
      )}
    </ReportPageShell>
  );
}
