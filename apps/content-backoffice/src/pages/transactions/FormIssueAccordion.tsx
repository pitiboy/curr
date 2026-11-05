import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import { useTranslate } from 'react-admin';

import {
  formIssueCounts,
  formIssueTone,
  type FormIssue,
} from './formIssues';

const iconSx = { fontSize: 20 } as const;

const summarySx = {
  '& .MuiAccordionSummary-content': {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 1,
    my: 1,
  },
} as const;

const listSx = {
  m: 0,
  pl: 2.5,
} as const;

/** Warning: yellow border on white. Error: red wash; icon stays red. */
const TONE = {
  warning: {
    bgcolor: '#FFFFFF',
    borderColor: '#F9A825',
    iconColor: '#F9A825',
  },
  error: {
    bgcolor: '#FFEBEE',
    borderColor: '#D32F2F',
    iconColor: '#D32F2F',
  },
} as const;

function accordionSx(tone: 'error' | 'warning') {
  const colors = TONE[tone];
  return {
    bgcolor: colors.bgcolor,
    backgroundImage: 'none',
    border: `1px solid ${colors.borderColor}`,
    borderRadius: 1,
    boxShadow: 'none',
    mb: 1,
    '&:before': { display: 'none' },
  } as const;
}

/** Shared error/warning accordion for create and finalize. */
export function FormIssueAccordion({
  hint,
  issues,
  title,
}: {
  hint: string;
  issues: FormIssue[];
  title: string;
}) {
  const translate = useTranslate();
  const { errors, warnings } = formIssueCounts(issues);
  const tone = formIssueTone(errors);

  return (
    <Accordion disableGutters defaultExpanded={false} sx={accordionSx(tone)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
        <WarningAmberIcon
          aria-hidden
          sx={{ ...iconSx, color: TONE[tone].iconColor }}
        />
        <Typography component="span" fontWeight={700} variant="subtitle1">
          {title}
        </Typography>
        {issues.length > 0 ? (
          <Typography component="span" fontWeight={600} variant="body2">
            {translate('app.form_issues_count', { errors, warnings })}
          </Typography>
        ) : null}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Typography sx={{ mb: issues.length > 0 ? 1 : 0 }} variant="body2">
          {hint}
        </Typography>
        {issues.length > 0 ? (
          <Box component="ul" sx={listSx}>
            {issues.map((issue) => (
              <Typography
                key={`${issue.level}:${issue.message}`}
                component="li"
                sx={{ mb: 0.5 }}
                variant="body2"
              >
                {issue.message}
              </Typography>
            ))}
          </Box>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
