import { Box, Typography, useTheme } from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ConvertPreview } from '../../data/convertPreview';
import {
  layoutSequenceDiagram,
  movementSequenceAriaSummary,
  SEQ_HEADER_HEIGHT,
  SEQ_MESSAGE_ROW_HEIGHT,
  SEQ_PADDING_Y,
  SEQ_SELF_LOOP_WIDTH,
  type SequenceMessage,
  type SequenceParticipant,
} from '../../data/convertPreviewGraph';

function messageStroke(
  kind: SequenceMessage['kind'],
  themeStroke: string,
  themeInfo: string,
  themeError: string,
): string {
  if (kind === 'original') return themeInfo;
  if (kind === 'storno') return themeError;
  return themeStroke;
}

function renderMessageArrow(
  message: SequenceMessage,
  participants: SequenceParticipant[],
  stroke: string,
) {
  const from = participants.find((row) => row.id === message.fromId);
  const to = participants.find((row) => row.id === message.toId);
  if (!from || !to) return null;

  const y = message.y;

  if (message.selfLoop) {
    const loopX = from.centerX + SEQ_SELF_LOOP_WIDTH;
    return (
      <g key={message.id}>
        <path
          d={`M ${from.centerX} ${y} H ${loopX} V ${y - 18} H ${from.centerX + 8}`}
          fill="none"
          markerEnd="url(#seq-arrow)"
          stroke={stroke}
          strokeWidth={1.75}
        />
        <text
          fill={stroke}
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          x={(from.centerX + loopX) / 2}
          y={y - 22}
        >
          <title>{message.label}</title>
          {message.label}
        </text>
      </g>
    );
  }

  const x1 = from.centerX;
  const x2 = to.centerX;
  const leftToRight = x1 < x2;
  const marker = leftToRight ? 'url(#seq-arrow)' : 'url(#seq-arrow-reverse)';
  const lineY = y;

  return (
    <g key={message.id}>
      <line
        markerEnd={marker}
        stroke={stroke}
        strokeWidth={1.75}
        x1={x1}
        x2={x2}
        y1={lineY}
        y2={lineY}
      />
      <text
        fill={stroke}
        fontSize={11}
        fontWeight={600}
        textAnchor="middle"
        x={(x1 + x2) / 2}
        y={lineY - 8}
      >
        <title>{message.label}</title>
        {message.label}
      </text>
      {message.description ? (
        <text
          fill="#666"
          fontSize={10}
          textAnchor="middle"
          x={(x1 + x2) / 2}
          y={lineY + 14}
        >
          <title>{message.description}</title>
          {message.description}
        </text>
      ) : null}
    </g>
  );
}

export function ConvertPreviewDiagram({
  preview,
}: {
  preview: ConvertPreview;
}) {
  const theme = useTheme();
  const translate = useTranslate();
  const layout = layoutSequenceDiagram(preview);
  const lifelineBottom =
    SEQ_HEADER_HEIGHT +
    SEQ_PADDING_Y +
    layout.messages.length * SEQ_MESSAGE_ROW_HEIGHT;

  const strokeDefault = theme.palette.text.primary;
  const strokeInfo = theme.palette.info.main;
  const strokeError = theme.palette.error.main;

  return (
    <Box sx={{ mt: 1, overflowX: 'auto' }}>
      <Typography color="text.secondary" variant="caption">
        {translate('app.transactions_convert_preview_sequence_legend')}
      </Typography>
      <Box
        aria-label={translate('app.transactions_convert_preview_diagram_aria', {
          summary: movementSequenceAriaSummary(preview),
        })}
        component="svg"
        role="img"
        sx={{
          display: 'block',
          minWidth: layout.width,
          width: '100%',
          maxWidth: layout.width,
          mt: 1,
        }}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <marker
            id="seq-arrow"
            markerHeight="8"
            markerUnits="strokeWidth"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="3"
          >
            <path d="M0,0 L0,6 L7,3 z" fill="context-stroke" />
          </marker>
          <marker
            id="seq-arrow-reverse"
            markerHeight="8"
            markerUnits="strokeWidth"
            markerWidth="8"
            orient="auto"
            refX="0"
            refY="3"
          >
            <path d="M7,0 L7,6 L0,3 z" fill="context-stroke" />
          </marker>
        </defs>

        {layout.participants.map((participant) => (
          <g key={participant.id}>
            <rect
              fill={participant.headerFill}
              height={SEQ_HEADER_HEIGHT - 4}
              rx={8}
              stroke={participant.isMember ? '#FFB74D' : '#B0BEC5'}
              strokeWidth={1}
              width={participant.width}
              x={participant.x}
              y={2}
            />
            <text
              fontSize={13}
              fontWeight={700}
              textAnchor="middle"
              x={participant.centerX}
              y={22}
            >
              {participant.code}
            </text>
            {participant.name ? (
              <text
                fill="#546E7A"
                fontSize={10}
                textAnchor="middle"
                x={participant.centerX}
                y={38}
              >
                <title>{participant.name}</title>
                {participant.name.length > 22
                  ? `${participant.name.slice(0, 21)}…`
                  : participant.name}
              </text>
            ) : null}
            <line
              stroke="#CFD8DC"
              strokeDasharray="4 4"
              strokeWidth={1}
              x1={participant.centerX}
              x2={participant.centerX}
              y1={SEQ_HEADER_HEIGHT}
              y2={lifelineBottom}
            />
          </g>
        ))}

        {layout.messages.map((message) =>
          renderMessageArrow(
            message,
            layout.participants,
            messageStroke(message.kind, strokeDefault, strokeInfo, strokeError),
          ),
        )}
      </Box>
    </Box>
  );
}
