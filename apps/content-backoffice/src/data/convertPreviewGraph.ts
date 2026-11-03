import type { ConvertPreview, PreviewMovement } from './convertPreview';

export const MEMBER_LEDGER_CODES = new Set(['1101', '1001']);
export const PREVIEW_NODE_WIDTH = 128;
export const PREVIEW_NODE_HEIGHT = 44;
export const PREVIEW_COLUMN_GAP = 96;
export const PREVIEW_ROW_GAP = 52;
export const PREVIEW_DIAGRAM_PADDING = 16;
export const PREVIEW_EDGE_LABEL_MAX = 48;
export const PREVIEW_DESCRIPTION_MAX = 64;

export type MovementGraphNode = {
  id: string;
  code: string;
  name: string | null;
  column: 'debit' | 'credit';
  x: number;
  y: number;
  isMember: boolean;
};

export type MovementGraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  kind: PreviewMovement['kind'] | 'original';
  stepIndex: number | null;
};

export type MovementGraphLayout = {
  width: number;
  height: number;
  nodes: MovementGraphNode[];
  edges: MovementGraphEdge[];
};

type AccountColumn = MovementGraphNode['column'];

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function accountNodeId(documentId: string, column: AccountColumn): string {
  return `${column}:${documentId}`;
}

function registerNode(
  map: Map<string, MovementGraphNode>,
  account: { documentId: string; code: string; name: string | null },
  column: AccountColumn,
): string {
  const id = accountNodeId(account.documentId, column);
  if (!map.has(id)) {
    map.set(id, {
      id,
      code: account.code,
      name: account.name,
      column,
      x: 0,
      y: 0,
      isMember: MEMBER_LEDGER_CODES.has(account.code),
    });
  }
  return id;
}

function edgeLabel(
  amount: number,
  currencyCode: string | null,
  stepIndex: number | null,
  percent: number | null,
): string {
  const currency = currencyCode ?? '?';
  const base = `${amount.toLocaleString('hu-HU')} ${currency}`;
  if (stepIndex != null) {
    const order = `#${stepIndex + 1}`;
    if (percent != null) {
      return truncate(`${order} ${base} (${percent}%)`, PREVIEW_EDGE_LABEL_MAX);
    }
    return truncate(`${order} ${base}`, PREVIEW_EDGE_LABEL_MAX);
  }
  return truncate(base, PREVIEW_EDGE_LABEL_MAX);
}

function layoutColumns(nodes: MovementGraphNode[]): void {
  const debitNodes = nodes.filter((node) => node.column === 'debit');
  const creditNodes = nodes.filter((node) => node.column === 'credit');
  const debitX = PREVIEW_DIAGRAM_PADDING;
  const creditX =
    PREVIEW_DIAGRAM_PADDING + PREVIEW_NODE_WIDTH + PREVIEW_COLUMN_GAP;

  debitNodes.forEach((node, index) => {
    node.x = debitX;
    node.y = PREVIEW_DIAGRAM_PADDING + index * PREVIEW_ROW_GAP;
  });
  creditNodes.forEach((node, index) => {
    node.x = creditX;
    node.y = PREVIEW_DIAGRAM_PADDING + index * PREVIEW_ROW_GAP;
  });
}

export function layoutMovementGraph(
  preview: ConvertPreview,
): MovementGraphLayout {
  const nodeMap = new Map<string, MovementGraphNode>();
  const edges: MovementGraphEdge[] = [];

  const originalDebit = registerNode(nodeMap, preview.original.debit, 'debit');
  const originalCredit = registerNode(
    nodeMap,
    preview.original.credit,
    'credit',
  );
  edges.push({
    id: 'original',
    fromId: originalDebit,
    toId: originalCredit,
    label: edgeLabel(
      preview.original.amount,
      preview.original.currency.code,
      null,
      null,
    ),
    kind: 'original',
    stepIndex: null,
  });

  for (const movement of preview.movements) {
    const fromId = registerNode(nodeMap, movement.debit, 'debit');
    const toId = registerNode(nodeMap, movement.credit, 'credit');
    edges.push({
      id: `${movement.kind}-${movement.index ?? 'storno'}`,
      fromId,
      toId,
      label: edgeLabel(
        movement.amount,
        movement.currency.code,
        movement.kind === 'step' ? movement.index : null,
        movement.percent,
      ),
      kind: movement.kind,
      stepIndex: movement.index,
    });
  }

  const nodes = [...nodeMap.values()].sort((left, right) => {
    if (left.column !== right.column) {
      return left.column === 'debit' ? -1 : 1;
    }
    return left.code.localeCompare(right.code, 'hu');
  });

  layoutColumns(nodes);

  const maxRows = Math.max(
    nodes.filter((node) => node.column === 'debit').length,
    nodes.filter((node) => node.column === 'credit').length,
    1,
  );
  const width =
    PREVIEW_DIAGRAM_PADDING * 2 + PREVIEW_NODE_WIDTH * 2 + PREVIEW_COLUMN_GAP;
  const height =
    PREVIEW_DIAGRAM_PADDING * 2 +
    PREVIEW_NODE_HEIGHT +
    (maxRows - 1) * PREVIEW_ROW_GAP;

  return { width, height, nodes, edges };
}

export function movementGraphAriaSummary(preview: ConvertPreview): string {
  const parts = [
    `${preview.original.amount} ${preview.original.currency.code ?? ''}`.trim(),
    `${preview.movements.length} movements`,
  ];
  return parts.join(', ');
}
