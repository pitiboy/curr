import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWatch } from 'react-hook-form';

import type { AccountChoice } from '../../data/accountCodes';
import type { AccountProfile } from '../../data/accountProfiles';
import {
  buildTransactionWorkflowMatchInput,
  resolveAccountRowSelection,
  type AccountRowSelection,
  type ResolvedAccountRowSelection,
} from '../../data/accountRowSelection';
import type { WorkflowTemplateHeader } from '../../data/transactionList';

export type TransactionCreateAccountRowContextValue = {
  accounts: AccountChoice[];
  transactionWorkflows: WorkflowTemplateHeader[];
  storedSelection: AccountRowSelection;
  setStoredSelection: (selection: AccountRowSelection) => void;
  resolved: ResolvedAccountRowSelection;
  lastProfile: AccountProfile;
  prefillAccountsResolved: boolean;
  setPrefillAccountsResolved: (value: boolean) => void;
  resetToProfileAfterStaleWorkflow: () => void;
};

const defaultResolved: ResolvedAccountRowSelection = {
  effectiveSelection: { kind: 'profile', profile: 'cost' },
  filterProfile: 'cost',
  workflowDropped: false,
  activeWorkflow: null,
};

function resolvedAccountRowSelectionEqual(
  left: ResolvedAccountRowSelection,
  right: ResolvedAccountRowSelection,
): boolean {
  return (
    left.filterProfile === right.filterProfile &&
    left.workflowDropped === right.workflowDropped &&
    left.activeWorkflow?.documentId === right.activeWorkflow?.documentId &&
    left.effectiveSelection.kind === right.effectiveSelection.kind &&
    (left.effectiveSelection.kind === 'profile'
      ? left.effectiveSelection.profile ===
        (right.effectiveSelection.kind === 'profile'
          ? right.effectiveSelection.profile
          : undefined)
      : right.effectiveSelection.kind === 'workflow' &&
        left.effectiveSelection.workflowDocumentId ===
          right.effectiveSelection.workflowDocumentId)
  );
}

const TransactionCreateAccountRowContext =
  createContext<TransactionCreateAccountRowContextValue | null>(null);

type InternalContextValue = TransactionCreateAccountRowContextValue & {
  publishResolved: (value: ResolvedAccountRowSelection) => void;
};

export function TransactionCreateAccountRowProvider({
  accounts,
  defaultProfile,
  initialStoredSelection,
  transactionWorkflows,
  children,
}: {
  accounts: AccountChoice[];
  defaultProfile: AccountProfile;
  /** Test / story override; Create uses profile default. */
  initialStoredSelection?: AccountRowSelection;
  transactionWorkflows: WorkflowTemplateHeader[];
  children: ReactNode;
}) {
  const [storedSelection, setStoredSelectionState] =
    useState<AccountRowSelection>(
      initialStoredSelection ?? {
        kind: 'profile',
        profile: defaultProfile,
      },
    );
  const [lastProfile, setLastProfile] =
    useState<AccountProfile>(defaultProfile);
  // Workflow initial selection must wait for prefill before match-based drop.
  const [prefillAccountsResolved, setPrefillAccountsResolved] = useState(
    () => initialStoredSelection?.kind !== 'workflow',
  );
  const [resolved, setResolvedState] =
    useState<ResolvedAccountRowSelection>(defaultResolved);
  const publishResolved = useCallback((next: ResolvedAccountRowSelection) => {
    setResolvedState((prev) =>
      resolvedAccountRowSelectionEqual(prev, next) ? prev : next,
    );
  }, []);

  const setStoredSelection = useCallback((selection: AccountRowSelection) => {
    if (selection.kind === 'profile') {
      setLastProfile(selection.profile);
      setPrefillAccountsResolved(true);
    } else {
      // Block match-based drop until useWorkflowPrefillOnSelect applies/clears
      // accounts for this template (avoids losing the incomplete-prefill warning).
      setPrefillAccountsResolved(false);
    }
    setStoredSelectionState(selection);
  }, []);

  const resetToProfileAfterStaleWorkflow = useCallback(() => {
    setStoredSelectionState({
      kind: 'profile',
      profile: lastProfile,
    });
    setPrefillAccountsResolved(true);
  }, [lastProfile]);

  const value = useMemo(
    (): TransactionCreateAccountRowContextValue => ({
      accounts,
      transactionWorkflows,
      storedSelection,
      setStoredSelection,
      resolved,
      lastProfile,
      prefillAccountsResolved,
      setPrefillAccountsResolved,
      resetToProfileAfterStaleWorkflow,
    }),
    [
      accounts,
      lastProfile,
      prefillAccountsResolved,
      resetToProfileAfterStaleWorkflow,
      resolved,
      setStoredSelection,
      storedSelection,
      transactionWorkflows,
    ],
  );

  const internalValue = useMemo(
    (): InternalContextValue => ({
      ...value,
      publishResolved,
    }),
    [publishResolved, value],
  );

  return (
    <TransactionCreateAccountRowContext.Provider value={internalValue}>
      {children}
    </TransactionCreateAccountRowContext.Provider>
  );
}

/** Mount inside SimpleForm so react-hook-form context is available. */
export function TransactionCreateAccountRowFormSync() {
  const ctx = useContext(
    TransactionCreateAccountRowContext,
  ) as InternalContextValue | null;

  const debitId = useWatch({ name: 'debit_account' });
  const creditId = useWatch({ name: 'credit_account' });
  const currencyId = useWatch({ name: 'currency_type' });
  const transactionTypeId = useWatch({ name: 'transaction_type' });

  const accounts = ctx?.accounts ?? [];
  const storedSelection = ctx?.storedSelection;
  const lastProfile = ctx?.lastProfile ?? '';
  const transactionWorkflows = ctx?.transactionWorkflows ?? [];
  const prefillAccountsResolved = ctx?.prefillAccountsResolved ?? true;
  const publishResolved = ctx?.publishResolved;
  const setStoredSelection = ctx?.setStoredSelection;

  const matchInput = useMemo(
    () =>
      buildTransactionWorkflowMatchInput({
        accounts,
        debitAccountDocumentId: debitId,
        creditAccountDocumentId: creditId,
        currencyTypeDocumentId: currencyId,
        transactionTypeDocumentId: transactionTypeId,
      }),
    [accounts, creditId, currencyId, debitId, transactionTypeId],
  );

  const nextResolved = useMemo(() => {
    if (!storedSelection) return null;
    return resolveAccountRowSelection({
      storedSelection,
      lastProfile,
      workflows: transactionWorkflows,
      matchInput,
      prefillAccountsResolved,
    });
  }, [
    lastProfile,
    matchInput,
    prefillAccountsResolved,
    storedSelection,
    transactionWorkflows,
  ]);

  useEffect(() => {
    if (!publishResolved || !nextResolved) return;
    publishResolved(nextResolved);
  }, [nextResolved, publishResolved]);

  useEffect(() => {
    if (!setStoredSelection || !storedSelection || !nextResolved) return;
    if (nextResolved.workflowDropped && storedSelection.kind === 'workflow') {
      setStoredSelection({
        kind: 'profile',
        profile: lastProfile,
      });
    }
  }, [lastProfile, nextResolved, setStoredSelection, storedSelection]);

  return null;
}

export function useTransactionCreateAccountRow(): TransactionCreateAccountRowContextValue {
  const ctx = useContext(TransactionCreateAccountRowContext);
  if (!ctx) {
    throw new Error(
      'useTransactionCreateAccountRow requires TransactionCreateAccountRowProvider',
    );
  }
  return ctx;
}

/** Optional hook for components that only exist on Create with the provider. */
export function useOptionalTransactionCreateAccountRow(): TransactionCreateAccountRowContextValue | null {
  return useContext(TransactionCreateAccountRowContext);
}
