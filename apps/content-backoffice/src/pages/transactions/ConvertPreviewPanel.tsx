import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePermissions, useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import { BackofficeConfigContext } from '../../workflows/backofficeConfigContext';
import { isEditorLikeRole } from '../../auth/roles';
import { useConvertPreview } from '../../workflows/useConvertPreview';
import type { ConvertOverridesPayload } from '../../data/transactionWorkflow';
import { ConvertPreviewDiagram } from './ConvertPreviewDiagram';
import { ConvertPreviewEditableTable } from './ConvertPreviewEditableTable';
import { ConvertPreviewTable } from './ConvertPreviewTable';
import {
  CONVERT_INLINE_EDIT_FEATURE_ID,
  blankLegRow,
  buildConvertOverridePayload,
  duplicateLegRow,
  editableRowsToPreview,
  previewToEditableRows,
  validateEditableRows,
  type EditableLegRow,
} from './convertPreviewEdit';

export type ConvertPreviewEditState = {
  editMode: boolean;
  /** Live override for convert; null when not editing, invalid, or unchanged. */
  overridePayload: ConvertOverridesPayload | null;
  editedRows: EditableLegRow[];
  blocking: string[];
};

const EMPTY_VALIDATION = {
  blocking: [] as string[],
  warnings: [] as string[],
};

function previewTransactionDate(input: ConvertPreviewRequest): string {
  if ('transaction' in input) return input.transaction.date;
  return new Date().toISOString().slice(0, 10);
}

export function ConvertPreviewPanel({
  previewInput,
  active,
  editMode = false,
  onEditModeChange,
  onEditStateChange,
}: {
  previewInput: ConvertPreviewRequest;
  active: boolean;
  editMode?: boolean;
  onEditModeChange?: (value: boolean) => void;
  onEditStateChange?: (state: ConvertPreviewEditState) => void;
}) {
  const translate = useTranslate();
  const { preview, loading, error } = useConvertPreview(previewInput, active);
  const { permissions } = usePermissions();
  const backofficeConfig = useContext(BackofficeConfigContext);
  const inlineEditEnabled =
    backofficeConfig?.enabled.includes(CONVERT_INLINE_EDIT_FEATURE_ID) ?? false;
  const canEdit = isEditorLikeRole(permissions) && inlineEditEnabled;

  const transactionDate = previewTransactionDate(previewInput);

  const [baselineRows, setBaselineRows] = useState<EditableLegRow[]>([]);
  const [rows, setRows] = useState<EditableLegRow[]>([]);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [stepsPublished, setStepsPublished] = useState(true);
  const [baselineKeepOriginal, setBaselineKeepOriginal] = useState(true);
  const [baselineStepsPublished, setBaselineStepsPublished] = useState(true);

  useEffect(() => {
    if (!preview) return;
    const next = previewToEditableRows(preview, transactionDate);
    setBaselineRows(next);
    setBaselineKeepOriginal(preview.workflow.keepOriginal);
    setBaselineStepsPublished(preview.workflow.stepsPublished);
    if (!editMode) {
      setRows(next);
      setKeepOriginal(preview.workflow.keepOriginal);
      setStepsPublished(preview.workflow.stepsPublished);
    }
  }, [preview, transactionDate, editMode]);

  const displayPreview = useMemo(() => {
    if (!preview) return preview;
    if (!editMode) return preview;
    const edited = editableRowsToPreview(preview, rows);
    return {
      ...edited,
      workflow: {
        ...edited.workflow,
        keepOriginal,
        stepsPublished,
      },
      movements: keepOriginal
        ? edited.movements
        : edited.movements.filter((movement) => movement.kind !== 'storno'),
    };
  }, [editMode, keepOriginal, preview, rows, stepsPublished]);

  const tableRows = useMemo(
    () => (keepOriginal ? rows : rows.filter((row) => row.kind !== 'storno')),
    [keepOriginal, rows],
  );

  const validation = useMemo(
    () =>
      preview && editMode
        ? validateEditableRows(preview, rows, translate)
        : EMPTY_VALIDATION,
    [editMode, preview, rows, translate],
  );

  const overridePayload = useMemo(
    () =>
      buildConvertOverridePayload({
        editMode,
        blocking: validation.blocking,
        rows,
        baselineRows,
        keepOriginal,
        stepsPublished,
        baselineKeepOriginal,
        baselineStepsPublished,
      }),
    [
      baselineKeepOriginal,
      baselineRows,
      baselineStepsPublished,
      editMode,
      keepOriginal,
      rows,
      stepsPublished,
      validation.blocking,
    ],
  );

  const onEditStateChangeRef = useRef(onEditStateChange);
  useLayoutEffect(() => {
    onEditStateChangeRef.current = onEditStateChange;
  });
  useEffect(() => {
    onEditStateChangeRef.current?.({
      editMode,
      overridePayload,
      editedRows: rows,
      blocking: validation.blocking,
    });
  }, [editMode, overridePayload, rows, validation.blocking]);

  const startEdit = () => {
    if (preview) {
      setKeepOriginal(preview.workflow.keepOriginal);
      setStepsPublished(preview.workflow.stepsPublished);
    }
    onEditModeChange?.(true);
  };

  const cancelEdits = () => {
    setRows(baselineRows);
    setKeepOriginal(baselineKeepOriginal);
    setStepsPublished(baselineStepsPublished);
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

  return (
    <Stack spacing={1} sx={{ mt: 0.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography color="text.secondary" variant="body2">
          {keepOriginal
            ? translate('app.transactions_convert_preview_keep_original')
            : translate('app.transactions_convert_preview_delete_original')}
          {' · '}
          {stepsPublished
            ? translate('app.transactions_convert_preview_steps_published')
            : translate('app.transactions_convert_preview_steps_draft')}
        </Typography>
        {canEdit ? (
          <Stack direction="row" spacing={1}>
            {!editMode ? (
              <Button size="small" variant="outlined" onClick={startEdit}>
                {translate('app.transactions_convert_edit_start')}
              </Button>
            ) : (
              <Button size="small" onClick={cancelEdits}>
                {translate('app.transactions_convert_edit_reset')}
              </Button>
            )}
          </Stack>
        ) : null}
      </Stack>
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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0, sm: 2 }}
            sx={{ flexWrap: 'wrap' }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={keepOriginal}
                  size="small"
                  onChange={(event) => setKeepOriginal(event.target.checked)}
                />
              }
              label={translate(
                keepOriginal
                  ? 'app.transactions_convert_preview_keep_original'
                  : 'app.transactions_convert_preview_delete_original',
              )}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={stepsPublished}
                  size="small"
                  onChange={(event) => setStepsPublished(event.target.checked)}
                />
              }
              label={translate(
                stepsPublished
                  ? 'app.transactions_convert_preview_steps_published'
                  : 'app.transactions_convert_preview_steps_draft',
              )}
            />
          </Stack>
          <ConvertPreviewEditableTable
            rows={tableRows}
            sourceAmount={preview.original.amount}
            onChange={(nextVisible) => {
              if (keepOriginal) {
                setRows(nextVisible);
                return;
              }
              // Storno is hidden but must stay in state for toggling keep_original back on.
              setRows((current) => {
                const storno = current.filter((row) => row.kind === 'storno');
                const original = nextVisible.filter(
                  (row) => row.kind === 'original',
                );
                const steps = nextVisible.filter((row) => row.kind === 'step');
                return [...original, ...storno, ...steps];
              });
            }}
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
