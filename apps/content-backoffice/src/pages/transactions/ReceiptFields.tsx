import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import {
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import { useEffect, useState, type ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDataProvider, useTranslate } from 'react-admin';

import { STRAPI_URL } from '../../config';
import { bandedSpanClass, withBands } from '../../theme';
import {
  receiptCardInvalid,
  receiptDocumentUrl,
  receiptIsPresent,
} from '../../data/receiptDraft';

export type ReceiptCardValue = {
  key: string;
  file: File | null;
  vendor: string;
  receiptTypeId: string;
};

type ReceiptTypeChoice = { id: string; name: string };

function emptyReceiptCard(): ReceiptCardValue {
  return {
    key: crypto.randomUUID(),
    file: null,
    vendor: '',
    receiptTypeId: '',
  };
}

type ReceiptRailProps = {
  cards: ReceiptCardValue[];
  onChange: (cards: ReceiptCardValue[]) => void;
  /** Already saved receipts. Shown above the add control, in the same block. */
  saved?: unknown;
};

const receiptFrameSx = {
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  boxSizing: 'border-box',
  contain: 'inline-size',
  m: 0,
  maxWidth: '100%',
  minInlineSize: 0,
  minWidth: 0,
  p: 1.5,
  width: '100%',
} as const;

function ReceiptFrame({ children }: { children: ReactNode }) {
  const translate = useTranslate();
  return (
    <Box
      className={bandedSpanClass}
      sx={{
        maxWidth: '100%',
        minInlineSize: 0,
        minWidth: 0,
        mt: 1,
        width: '100%',
      }}
    >
      <Box component="fieldset" sx={receiptFrameSx}>
        <Typography component="legend" sx={{ px: 0.5 }} variant="subtitle1">
          {translate('app.receipt_block')}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function ReceiptHint({ sx }: { sx?: SxProps<Theme> }) {
  const translate = useTranslate();
  return (
    <Typography color="text.secondary" sx={sx} variant="body2">
      {translate('app.receipt_optional')} {translate('app.receipt_prefill')}
    </Typography>
  );
}

/** Horizontal card rail. Narrow screens stack the cards. */
export function ReceiptRail({ cards, onChange, saved }: ReceiptRailProps) {
  const translate = useTranslate();
  const types = useReceiptTypes();
  const savedItems = presentReceipts(saved);

  function update(key: string, patch: Partial<ReceiptCardValue>) {
    onChange(
      cards.map((card) => (card.key === key ? { ...card, ...patch } : card)),
    );
  }

  return (
    <ReceiptFrame>
      {savedItems.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <SavedReceiptCards receipts={savedItems} />
        </Box>
      ) : (
        <ReceiptHint sx={{ mb: 1 }} />
      )}
      <Box
        sx={{
          maxWidth: '100%',
          minWidth: 0,
          overflowX: { xs: 'visible', sm: 'auto' },
          overflowY: 'hidden',
        }}
      >
        <Box
          sx={withBands({
            alignItems: 'stretch',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            pb: 1,
            width: { xs: '100%', sm: 'max-content' },
          })}
        >
          {cards.map((card) => (
            <ReceiptCard
              card={card}
              key={card.key}
              types={types}
              onChange={(patch) => update(card.key, patch)}
              onRemove={() =>
                onChange(cards.filter((item) => item.key !== card.key))
              }
            />
          ))}
          <Box
            sx={{
              alignItems: 'center',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              boxSizing: 'border-box',
              display: 'flex',
              flex: { xs: '1 1 auto', sm: '0 0 16rem' },
              justifyContent: 'center',
              minHeight: '8rem',
              minWidth: 0,
              p: 2,
              width: { xs: '100%', sm: '16rem' },
            }}
          >
            <Button
              type="button"
              variant="outlined"
              onClick={() => onChange([...cards, emptyReceiptCard()])}
            >
              {translate('app.receipt_add')}
            </Button>
          </Box>
        </Box>
      </Box>
      {savedItems.length > 0 ? <ReceiptHint sx={{ mt: 1 }} /> : null}
    </ReceiptFrame>
  );
}

function ReceiptCard({
  card,
  types,
  onChange,
  onRemove,
}: {
  card: ReceiptCardValue;
  types: ReceiptTypeChoice[];
  onChange: (patch: Partial<ReceiptCardValue>) => void;
  onRemove: () => void;
}) {
  const translate = useTranslate();
  const invalid = receiptCardInvalid(card);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: invalid ? 'error.main' : 'divider',
        borderRadius: 1,
        boxSizing: 'border-box',
        display: 'flex',
        flex: { xs: '1 1 auto', sm: '0 0 18rem' },
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        overflow: 'hidden',
        p: 2,
        width: { xs: '100%', sm: '18rem' },
      }}
    >
      <TextField
        error={Boolean(card.file && !card.receiptTypeId)}
        fullWidth
        label={translate('app.receipt_type')}
        select
        size="small"
        value={card.receiptTypeId}
        onChange={(event) => onChange({ receiptTypeId: event.target.value })}
      >
        {types.map((type) => (
          <MenuItem key={type.id} value={type.id}>
            {type.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        error={Boolean(card.file && !card.vendor.trim())}
        fullWidth
        label={translate('app.receipt_vendor')}
        size="small"
        value={card.vendor}
        onChange={(event) => onChange({ vendor: event.target.value })}
      />
      <ReceiptDropzone file={card.file} onFile={(file) => onChange({ file })} />
      {invalid ? (
        <Typography color="error" variant="body2">
          {translate('app.receipt_card_required')}
        </Typography>
      ) : null}
      <Button size="small" type="button" onClick={onRemove}>
        {translate('app.receipt_remove')}
      </Button>
    </Box>
  );
}

const HATCH_PERIOD = 8;

/** Empty dropzone: the hatch opacity breathes. One full pulse is 2s. */
function receiptDropCue(playing: boolean, drag: boolean, filled: boolean): SxProps<Theme> {
  return (theme) => {
    const line = alpha(
      theme.palette.primary.main,
      theme.palette.mode === 'dark' ? 0.28 : 0.14,
    );
    const filledBg =
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.common.white, 0.08)
        : theme.palette.grey[200];
    return {
      '@keyframes receiptDropHatch': {
        '0%, 100%': { opacity: 0.35 },
        '50%': { opacity: 1 },
      },
      '@media (prefers-reduced-motion: reduce)': {
        '&::before': { animation: 'none', opacity: 1 },
      },
      '&:focus-visible': {
        outline: '2px solid',
        outlineColor: 'primary.main',
        outlineOffset: 2,
      },
      '&::before': playing
        ? {
            animation: 'receiptDropHatch 2s ease-in-out infinite',
            backgroundImage: `repeating-linear-gradient(45deg, transparent 0 7px, ${line} 7px ${HATCH_PERIOD}px)`,
            borderRadius: 'inherit',
            content: '""',
            inset: 0,
            pointerEvents: 'none',
            position: 'absolute',
          }
        : undefined,
      alignItems: 'center',
      bgcolor: filled ? filledBg : drag ? 'action.hover' : 'transparent',
      border: '1px dashed',
      borderColor: drag ? 'primary.main' : 'divider',
      borderRadius: 1,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      justifyContent: 'center',
      position: 'relative',
      px: 2,
      py: 3,
      textAlign: 'center',
    };
  };
}

function ReceiptFileMark({
  file,
  prominent = false,
}: {
  file: { name: string; type: string };
  prominent?: boolean;
}) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const sx = {
    color: prominent ? 'primary.main' : 'text.secondary',
    flexShrink: 0,
    fontSize: prominent ? 44 : 40,
    position: 'relative',
  } as const;
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return <PictureAsPdfOutlinedIcon sx={sx} />;
  }
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/.test(name)) {
    return <ImageOutlinedIcon sx={sx} />;
  }
  if (
    type.includes('sheet') ||
    type.includes('excel') ||
    type === 'text/csv' ||
    /\.(xlsx?|csv|ods)$/.test(name)
  ) {
    return <TableChartOutlinedIcon sx={sx} />;
  }
  if (type.includes('word') || type.startsWith('text/') || /\.(docx?|odt|rtf|txt)$/.test(name)) {
    return <DescriptionOutlinedIcon sx={sx} />;
  }
  return <InsertDriveFileOutlinedIcon sx={sx} />;
}

function ReceiptDropzone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const translate = useTranslate();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDrop: (accepted) => {
      const next = accepted[0];
      if (next && next.size > 0) onFile(next);
    },
  });

  return (
    <Box>
      <Box
        {...getRootProps()}
        sx={receiptDropCue(!file && !isDragActive, isDragActive, Boolean(file))}
      >
        <input {...getInputProps()} />
        {file ? <ReceiptFileMark file={file} /> : null}
        <Typography
          color={file ? 'text.primary' : 'text.secondary'}
          sx={{ overflowWrap: 'anywhere', position: 'relative' }}
          variant="body2"
        >
          {file ? file.name : translate('app.receipt_drop')}
        </Typography>
      </Box>
      {file ? (
        <Button size="small" type="button" onClick={() => onFile(null)}>
          {translate('app.receipt_clear')}
        </Button>
      ) : null}
    </Box>
  );
}

function useReceiptTypes(): ReceiptTypeChoice[] {
  const dataProvider = useDataProvider();
  const [types, setTypes] = useState<ReceiptTypeChoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .getList('receipt-types', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      })
      .then(({ data }) => {
        if (cancelled) return;
        setTypes(
          data
            .map((row) => ({
              id: String(row.id ?? ''),
              name: typeof row.name === 'string' ? row.name : '',
            }))
            .filter((row) => row.id && row.name),
        );
      })
      .catch(() => {
        if (!cancelled) setTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dataProvider]);

  return types;
}

/** Saved receipt files, as their own cards. Read-only show, no add control. */
export function SavedReceiptSection({ receipts }: { receipts: unknown }) {
  const items = presentReceipts(receipts);
  if (items.length === 0) return null;
  return (
    <ReceiptFrame>
      <SavedReceiptCards receipts={items} />
    </ReceiptFrame>
  );
}

function SavedReceiptCards({ receipts }: { receipts: unknown[] }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        width: '100%',
      }}
    >
      {receipts.map((receipt, index) => (
        <SavedReceiptCard key={receiptKey(receipt, index)} receipt={receipt} />
      ))}
    </Box>
  );
}

function SavedReceiptCard({ receipt }: { receipt: unknown }) {
  const translate = useTranslate();
  const file = receiptFileMeta(receipt);
  const typeName = receiptTypeName(receipt);
  const vendor = receiptVendor(receipt);
  const title =
    file.name || typeName || translate('resources.transactions.fields.receipt');
  const url = receiptDocumentUrl(receipt, STRAPI_URL);

  return (
    <Box
      sx={(theme) => ({
        bgcolor: alpha(
          theme.palette.primary.main,
          theme.palette.mode === 'dark' ? 0.16 : 0.08,
        ),
        border: 1,
        borderColor: 'primary.main',
        borderRadius: 1,
        boxSizing: 'border-box',
        display: 'flex',
        flex: { xs: '1 1 auto', sm: '1 1 18rem' },
        flexDirection: 'column',
        gap: 1.5,
        maxWidth: { sm: '22rem' },
        minHeight: '8rem',
        minWidth: 0,
        p: 2,
        width: { xs: '100%', sm: '18rem' },
      })}
    >
      <Box sx={{ alignItems: 'flex-start', display: 'flex', gap: 1.5, minWidth: 0 }}>
        <ReceiptFileMark file={{ name: file.name, type: file.mime }} prominent />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
            variant="subtitle1"
          >
            {title}
          </Typography>
          {typeName && typeName !== title ? (
            <Typography color="text.secondary" variant="body2">
              {typeName}
            </Typography>
          ) : null}
          {vendor ? (
            <Typography color="text.secondary" variant="body2">
              {vendor}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {url ? (
        <Button
          component="a"
          href={url}
          rel="noopener noreferrer"
          size="small"
          sx={{ alignSelf: 'flex-start', mt: 'auto' }}
          target="_blank"
          variant="contained"
          onClick={(event) => event.stopPropagation()}
        >
          {translate('app.receipt_open')}
        </Button>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 'auto' }} variant="body2">
          {translate(receiptIsPresent(receipt) ? 'app.receipt_yes' : 'app.receipt_no')}
        </Typography>
      )}
    </Box>
  );
}

function presentReceipts(receipts: unknown): unknown[] {
  if (!Array.isArray(receipts)) return [];
  return receipts.filter((item) => receiptIsPresent(item));
}

function receiptFileMeta(receipt: unknown): { name: string; mime: string } {
  if (!receipt || typeof receipt !== 'object') return { name: '', mime: '' };
  const document = (receipt as { document?: unknown }).document;
  const file = Array.isArray(document) ? document[0] : document;
  if (!file || typeof file !== 'object') return { name: '', mime: '' };
  const name = (file as { name?: unknown }).name;
  const mime = (file as { mime?: unknown }).mime;
  return {
    name: typeof name === 'string' ? name.trim() : '',
    mime: typeof mime === 'string' ? mime : '',
  };
}

function receiptVendor(receipt: unknown): string {
  if (!receipt || typeof receipt !== 'object') return '';
  const vendor = (receipt as { vendor?: unknown }).vendor;
  return typeof vendor === 'string' ? vendor.trim() : '';
}

function receiptTypeName(receipt: unknown): string {
  if (!receipt || typeof receipt !== 'object' || !('receipt_type' in receipt)) {
    return '';
  }
  const type = (receipt as { receipt_type?: { name?: unknown } | null })
    .receipt_type;
  return type && typeof type.name === 'string' ? type.name : '';
}

function receiptKey(receipt: unknown, index: number): string {
  if (receipt && typeof receipt === 'object' && 'documentId' in receipt) {
    const id = (receipt as { documentId?: unknown }).documentId;
    if (typeof id === 'string' && id) return id;
  }
  return String(index);
}
