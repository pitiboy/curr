import { Box, Typography, useTheme } from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ConvertPreview } from '../../data/convertPreview';
import {
  layoutMovementGraph,
  movementGraphAriaSummary,
  PREVIEW_NODE_HEIGHT,
  PREVIEW_NODE_WIDTH,
} from '../../data/convertPreviewGraph';

function nodeLabel(code: string, name: string | null): string {
  return name ? `${code} ${name}` : code;
}

export function ConvertPreviewDiagram({
  preview,
}: {
  preview: ConvertPreview;
}) {
  const theme = useTheme();
  const translate = useTranslate();
  const layout = layoutMovementGraph(preview);
  const memberFill = theme.palette.warning.light;
  const memberStroke = theme.palette.warning.dark;
  const nodeFill = theme.palette.background.paper;
  const nodeStroke = theme.palette.divider;
  const edgeColor = theme.palette.text.secondary;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography color="text.secondary" variant="caption">
        {translate('app.transactions_convert_preview_legend')}
      </Typography>
      <Box
        aria-label={translate('app.transactions_convert_preview_diagram_aria', {
          summary: movementGraphAriaSummary(preview),
        })}
        component="svg"
        role="img"
        sx={{ width: '100%', maxWidth: layout.width, display: 'block' }}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <marker
            id="preview-arrow"
            markerHeight="8"
            markerUnits="strokeWidth"
            markerWidth="8"
            orient="auto"
            refX="6"
            refY="3"
          >
            <path d="M0,0 L0,6 L6,3 z" fill={edgeColor} />
          </marker>
        </defs>
        {layout.edges.map((edge) => {
          const from = layout.nodes.find((node) => node.id === edge.fromId);
          const to = layout.nodes.find((node) => node.id === edge.toId);
          if (!from || !to) return null;
          const x1 = from.x + PREVIEW_NODE_WIDTH;
          const y1 = from.y + PREVIEW_NODE_HEIGHT / 2;
          const x2 = to.x;
          const y2 = to.y + PREVIEW_NODE_HEIGHT / 2;
          const midX = (x1 + x2) / 2;
          return (
            <g key={edge.id}>
              <line
                markerEnd="url(#preview-arrow)"
                stroke={edgeColor}
                strokeWidth={1.5}
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
              />
              <text
                fill={edgeColor}
                fontSize={11}
                textAnchor="middle"
                x={midX}
                y={Math.min(y1, y2) - 6}
              >
                <title>{edge.label}</title>
                {edge.label}
              </text>
            </g>
          );
        })}
        {layout.nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <rect
              fill={node.isMember ? memberFill : nodeFill}
              height={PREVIEW_NODE_HEIGHT}
              rx={6}
              stroke={node.isMember ? memberStroke : nodeStroke}
              strokeWidth={1.5}
              width={PREVIEW_NODE_WIDTH}
            />
            <text
              dominantBaseline="middle"
              fill={theme.palette.text.primary}
              fontSize={12}
              fontWeight={600}
              textAnchor="middle"
              x={PREVIEW_NODE_WIDTH / 2}
              y={PREVIEW_NODE_HEIGHT / 2 - 6}
            >
              {node.code}
            </text>
            {node.name ? (
              <text
                dominantBaseline="middle"
                fill={theme.palette.text.secondary}
                fontSize={10}
                textAnchor="middle"
                x={PREVIEW_NODE_WIDTH / 2}
                y={PREVIEW_NODE_HEIGHT / 2 + 10}
              >
                <title>{nodeLabel(node.code, node.name)}</title>
                {node.name.length > 18
                  ? `${node.name.slice(0, 17)}…`
                  : node.name}
              </text>
            ) : null}
          </g>
        ))}
      </Box>
    </Box>
  );
}
