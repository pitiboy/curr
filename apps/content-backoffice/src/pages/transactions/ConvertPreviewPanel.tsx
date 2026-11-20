import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useContext, useEffect, useMemo, useState } from 'react';
import { usePermissions, useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import { BackofficeConfigContext } from '../../workflows/backofficeConfigContext';
import { isEditorLikeRole } from '../../auth/roles';
import { useConvertPreview } from '../../workflows/useConvertPreview';
import { ConvertPreviewDiagram } from './ConvertPreviewDiagram';
import { ConvertPreviewEditableTable } from './ConvertPreviewEditableTable';
import { ConvertPreviewTable } from './ConvertPreviewTable';
import {
  CONVERT_INLINE_EDIT_FEATURE_ID,
  blankLegRow,
  duplicateLegRow,
  editableRowsToPreview,
  overridesDifferFromBaseline,
  previewToEditableRows,
  rowsToOverridePayload,
  validateEditableRows,
  type EditableLegRow,
} from './convertPreviewEdit';
import type { ConvertOverridesPayload } from '../../data/transactionWorkflow';

export type ConvertPreviewEditState = {
  editMode: boolean;
  savedOverridePayload: ConvertOverridesPayload | null;
  editedRows: EditableLegRow[];
};

export function ConvertPreviewPanel({
  previewInput,
  active,
  editMode = false,
  onEditModeChange,
  onEditStateChange,
  onSavedOverride,
}: {
  previewInput: ConvertPreviewRequest;
  active: boolean;
  editMode?: boolean;
  onEditModeChange?: (value: boolean) => void;
  onEditStateChange?: (state: ConvertPreviewEditState) => void;
  onSavedOverride?: (payload: ConvertOverridesPayload | null) => void;
}) {
  const translate = useTranslate();
  const { preview, loading, error } = useConvertPreview(previewInput, active);
  const { data: permissions } = usePermissions();
  const backofficeConfig = useContext(BackofficeConfigContext);
  const inlineEditEnabled =
    backofficeConfig?.enabled.includes(CONVERT_INLINE_EDIT_FEATURE_ID) ?? false;
  const canEdit = isEditorLikeRole(permissions) && inlineEditEnabled;

  const transactionDocumentId = previewInput.transactionDocumentId;
  const transactionDate =
    previewInput.transaction?.date ?? new Date().toISOString().slice(0, 10);

  const [baselineRows, setBaselineRows] = useState<EditableLegRow[]>([]);
  const [rows, setRows] = useState<EditableLegRow[]>([]);
  const [savedOverridePayload, setSavedOverridePayload] =
    useState<ConvertOverridesPayload | null>(null);

  useEffect(() => {
    if (!preview) return;
    const next = previewToEditableRows(preview, transactionDate);
    setBaselineRows(next);
    if (!editMode) {
      setRows(next);
      setSavedOverridePayload(null);
    }
  }, [preview, transactionDate, editMode]);

  useEffect(() => {
    onEditStateChange?.({
      editMode,
      savedOverridePayload,
      editedRows: rows,
    });
  }, [editMode, onEditStateChange, rows, savedOverridePayload]);

  const displayPreview = useMemo(
    () =>
      preview && editMode ? editableRowsToPreview(preview, rows) : preview,
    [editMode, preview, rows],
  );

  const validation = useMemo(
    () =>
      preview && editMode
        ? validateEditableRows(preview, rows, translate)
        : { blocking: [], warnings: [] },
    [editMode, preview, rows, translate],
  );

  const resetEdits = () => {
    setRows(baselineRows);
    setSavedOverridePayload(null);
    onSavedOverride?.(null);
  };

  const saveEdits = () => {
    if (validation.blocking.length > 0) return;
    const payload: ConvertOverridesPayload = {
      legs: rowsToOverridePayload(rows),
    };
    setSavedOverridePayload(payload);
    onSavedOverride?.(payload);
    onEditModeChange?.(false);
  };

  const addBlankRow = () => {
    if (!preview) return;
    const key = `custom:${crypto.randomUUID()}`;
    setRows((current) => [
      ...current,
      blankLegRow(preview, transactionDate, key),
    ]);
  };

  if (loading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 3 }}>
        <CircularProgress size={32} />
        <Typography sx={{ mt: 1 }} variant="body2">
          {translate('app.transactions_convert_preview_loading')}
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        {error || translate('app.transactions_convert_preview_error')}
      </Alert>
    );
  }

  if (!preview || !displayPreview) {
    return (
      <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
        {translate('app.transactions_convert_preview_empty')}
      </Typography>
    );
  }

  const hasUnsavedEdits =
    editMode || overridesDifferFromBaseline(rows, baselineRows);

  return (
    <Stack spacing={1} sx={{ mt: 0.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography color="text.secondary" variant="body2">
          {preview.workflow.keepOriginal
            ? translate('app.transactions_convert_preview_keep_original')
            : translate('app.transactions_convert_preview_delete_original')}
          {' · '}
          {preview.workflow.stepsPublished
            ? translate('app.transactions_convert_preview_steps_published')
            : translate('app.transactions_convert_preview_steps_draft')}
        </Typography>
        {canEdit && previewInput.transactionDocumentId ? (
          <Stack direction="row" spacing={1}>
            {!editMode ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => onEditModeChange?.(true)}
              >
                {translate('app.transactions_convert_edit_start')}
              </Button>
            ) : (
              <>
                <Button size="small" onClick={resetEdits}>
                  {translate('app.transactions_convert_edit_reset')}
                </Button>
                <Button
                  disabled={validation.blocking.length > 0}
                  size="small"
                  variant="contained"
                  onClick={saveEdits}
                >
                  {translate('app.transactions_convert_edit_save')}
                </Button>
              </>
            )}
          </Stack>
        ) : null}
      </Stack>
      {hasUnsavedEdits && savedOverridePayload ? (
        <Alert severity="info">
          {translate('app.transactions_convert_edit_saved_hint')}
        </Alert>
      ) : null}
      {[...preview.warnings, ...validation.warnings].map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}
      {validation.blocking.map((message) => (
        <Alert key={message} severity="error">
          {message}
        </Alert>
      ))}
      <ConvertPreviewDiagram preview={displayPreview} />
      {editMode ? (
        <>
          <ConvertPreviewEditableTable
            rows={rows}
            sourceAmount={preview.original.amount}
            onChange={setRows}
            onDelete={(key) =>
              setRows((current) => current.filter((row) => row.key !== key))
            }
            onDuplicate={(row) => {
              const key = `custom:${crypto.randomUUID()}`;
              setRows((current) => [...current, duplicateLegRow(row, key)]);
            }}
          />
          <Button size="small" onClick={addBlankRow}>
            {translate('app.transactions_convert_edit_add_row')}
          </Button>
        </>
      ) : (
        <ConvertPreviewTable preview={displayPreview} />
      )}
    </Stack>
  );
}
