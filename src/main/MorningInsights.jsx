import { Link as RouterLink } from 'react-router-dom';
import { Button, ButtonBase, Link, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { glass } from '../common/theme/surfaces';
import usePersistedState from '../common/util/usePersistedState';
import { todayKey, useInsightText, useMorningFindings } from './morningFindings';

const useStyles = makeStyles()((theme) => ({
  root: {
    pointerEvents: 'auto',
    width: 340,
    maxWidth: 'calc(100vw - 32px)',
    // On a phone, clear of the map controls at the end side.
    [theme.breakpoints.down('md')]: {
      maxWidth: 'calc(100% - 88px)',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  pill: {
    ...glass(theme, 0.94),
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.tokens.radius.pill,
    fontFamily: theme.typography.fontFamily,
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[2],
  },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingInline: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    backgroundColor: theme.palette.cta.main,
    color: theme.palette.cta.contrastText,
  },
  expand: {
    transition: theme.transitions.create('transform'),
  },
  expanded: {
    transform: 'rotate(180deg)',
  },
  hide: {
    ...glass(theme, 0.94),
    alignSelf: 'flex-start',
    borderRadius: theme.tokens.radius.pill,
    paddingInline: theme.spacing(1.5),
  },
  card: {
    ...glass(theme, 0.96),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  title: {
    flex: 1,
    fontWeight: 600,
  },
}));

// AI-02: up to four findings each morning, beside the map: the title, why, and a link to the
// evidence. Folded into a pill until opened; hidden for the day on request.
const MorningInsights = ({ className }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const [open, setOpen] = usePersistedState('morningInsightsOpen', false);
  const [hiddenOn, setHiddenOn] = usePersistedState('morningInsightsHidden', null);
  const findings = useMorningFindings({ skip: hiddenOn === todayKey() });
  const text = useInsightText();

  if (!findings?.length || hiddenOn === todayKey()) return null;

  return (
    <section className={cx(classes.root, className)} aria-label={t('insightsTitle')}>
      <ButtonBase className={classes.pill} onClick={() => setOpen(!open)} aria-expanded={open}>
        <LightbulbRoundedIcon fontSize="small" />
        {t('insightsTitle')}
        <span className={classes.count}>{findings.length}</span>
        <ExpandMoreRoundedIcon
          fontSize="small"
          className={cx(classes.expand, open && classes.expanded)}
        />
      </ButtonBase>
      {open && (
        <>
          {findings.map((finding) => (
            <Paper key={finding.id} elevation={0} className={classes.card}>
              <div className={classes.head}>
                <Typography variant="body2" component="h3" className={classes.title}>
                  {text(finding, 'Title')}
                </Typography>
              </div>
              <Typography variant="body2" color="textSecondary">
                {text(finding, 'Why')}
              </Typography>
              <Link component={RouterLink} to={finding.link} variant="body2">
                {t('insightsEvidence')}
              </Link>
            </Paper>
          ))}
          <Button
            size="small"
            startIcon={<CloseRoundedIcon fontSize="small" />}
            onClick={() => setHiddenOn(todayKey())}
            className={classes.hide}
          >
            {t('insightsHideToday')}
          </Button>
        </>
      )}
    </section>
  );
};

export default MorningInsights;
