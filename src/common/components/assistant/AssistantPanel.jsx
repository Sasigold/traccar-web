import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  Drawer,
  IconButton,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useTranslation } from '../LocalizationProvider';
import { aiErrorKey } from '../../fleet/ai';
import useAssistant from './useAssistant';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: 460,
    maxWidth: '100vw',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.down('md')]: {
      width: '100vw',
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1, 1.5, 2),
    paddingTop: `calc(${theme.spacing(1.5)} + env(safe-area-inset-top, 0px))`,
    borderBlockEnd: `1px solid ${theme.palette.divider}`,
  },
  title: {
    flex: 1,
    fontWeight: 600,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  question: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
    whiteSpace: 'pre-wrap',
  },
  answer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  text: {
    whiteSpace: 'pre-wrap',
  },
  table: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.tokens.radius.md,
    overflowX: 'auto',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
  examples: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  form: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    paddingBottom: `calc(${theme.spacing(1.5)} + env(safe-area-inset-bottom, 0px))`,
    borderBlockStart: `1px solid ${theme.palette.divider}`,
  },
  note: {
    paddingInline: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

const EXAMPLES = ['assistantExample1', 'assistantExample2', 'assistantExample3'];

// AI-01: questions about the fleet in plain language, from Ctrl+K. Answers come with a table,
// follow-up questions and the report behind them.
const AssistantPanel = ({ open, onClose, initialQuestion }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const { turns, busy, ask, reset } = useAssistant();
  const [draft, setDraft] = useState('');
  const bodyRef = useRef(null);
  const askedRef = useRef(null);

  useEffect(() => {
    if (open && initialQuestion && askedRef.current !== initialQuestion) {
      askedRef.current = initialQuestion;
      ask(initialQuestion);
    }
  }, [open, initialQuestion, ask]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [turns]);

  const send = (question) => {
    ask(question);
    setDraft('');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { className: classes.paper, 'aria-labelledby': 'assistant-title' },
      }}
      variant="temporary"
    >
      <div className={classes.header}>
        <AutoAwesomeRoundedIcon color="primary" />
        <Typography id="assistant-title" variant="h6" component="h2" className={classes.title}>
          {t('assistantTitle')}
        </Typography>
        {turns.length > 0 && (
          <Button size="small" onClick={reset} disabled={busy}>
            {t('assistantNew')}
          </Button>
        )}
        <IconButton aria-label={t('a11yClose')} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </div>
      <div className={classes.body} ref={bodyRef} aria-live="polite">
        {!turns.length && (
          <div className={classes.examples}>
            <Typography color="textSecondary">{t('assistantIntro')}</Typography>
            {EXAMPLES.map((key) => (
              <Chip key={key} variant="outlined" label={t(key)} onClick={() => send(t(key))} />
            ))}
          </div>
        )}
        {turns.map((turn, index) => (
          <div key={index} className={classes.answer}>
            <Typography className={classes.question}>{turn.question}</Typography>
            {turn.pending && (
              <>
                <LinearProgress aria-label={t('assistantWorking')} />
                <Typography variant="caption" color="textSecondary" role="status">
                  {turn.steps.length
                    ? t('assistantFetching').replace(
                        '{0}',
                        turn.steps.map((step) => t(`assistantTool_${step}`)).join(', '),
                      )
                    : t('assistantWorking')}
                </Typography>
              </>
            )}
            {turn.error && <Alert severity="warning">{t(aiErrorKey(turn.error))}</Alert>}
            {turn.text && <Typography className={classes.text}>{turn.text}</Typography>}
            {turn.tables?.map((table, tableIndex) => (
              <div key={tableIndex} className={classes.table}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {table.columns.map((column) => (
                        <TableCell key={column}>{column}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {table.rows.slice(0, 100).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <bdi>{cell}</bdi>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            {turn.link && (
              <Link component={RouterLink} to={turn.link} onClick={onClose}>
                {t('assistantOpenReport')}
              </Link>
            )}
            {index === turns.length - 1 && turn.followups?.length > 0 && (
              <div className={classes.chips}>
                {turn.followups.map((followup) => (
                  <Chip
                    key={followup}
                    size="small"
                    variant="outlined"
                    label={followup}
                    onClick={() => send(followup)}
                    disabled={busy}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <Typography variant="caption" className={classes.note}>
        {t('assistantNote')}
      </Typography>
      <form
        className={classes.form}
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
          placeholder={t('assistantPlaceholder')}
          autoFocus={!phone}
          slotProps={{ htmlInput: { 'aria-label': t('assistantPlaceholder'), maxLength: 2000 } }}
        />
        <IconButton
          type="submit"
          color="primary"
          aria-label={t('assistantSend')}
          disabled={busy || !draft.trim()}
        >
          <SendRoundedIcon
            sx={{ transform: theme.direction === 'rtl' ? 'scaleX(-1)' : undefined }}
          />
        </IconButton>
      </form>
    </Drawer>
  );
};

export default AssistantPanel;
