import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { Button, ButtonBase, Link, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { computeInsights } from '../common/fleet/insights';
import { glass } from '../common/theme/surfaces';
import { useRestriction } from '../common/util/permissions';
import usePersistedState from '../common/util/usePersistedState';

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

const DAY = 86400000;
const todayKey = () => new Date().toLocaleDateString('en-CA');

// The fleet's last 28 days by day, and yesterday's trips: two report requests, once a day.
const loadFindings = async (devices, positions, signal) => {
  const ids = Object.keys(devices);
  if (!ids.length) return [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const query = (from, to, extra = {}) => {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      ...extra,
    });
    ids.forEach((id) => params.append('deviceId', id));
    return params;
  };
  const get = async (path, params) =>
    (
      await fetchOrThrow(`api/reports/${path}?${params}`, {
        signal,
        headers: { Accept: 'application/json' },
      })
    ).json();
  const [daily, trips] = await Promise.all([
    get('summary', query(new Date(today.getTime() - 28 * DAY), now, { daily: 'true' })),
    get('trips', query(new Date(today.getTime() - DAY), new Date(today.getTime() - 1))),
  ]);
  return computeInsights({ daily, trips, positions, devices }, now);
};

// AI-02: up to four findings each morning, beside the map: the title, why, and a link to the
// evidence. Folded into a pill until opened; hidden for the day on request.
const MorningInsights = ({ className }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const userId = useSelector((state) => state.session.user?.id);
  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const deviceCount = Object.keys(devices).length;
  const [open, setOpen] = usePersistedState('morningInsightsOpen', false);
  const [hiddenOn, setHiddenOn] = usePersistedState('morningInsightsHidden', null);
  const [findings, setFindings] = useState(null);

  useEffect(() => {
    if (readonly || disableReports || !deviceCount || hiddenOn === todayKey()) return undefined;
    const key = `morningInsights:${userId}:${todayKey()}`;
    const cached = window.sessionStorage.getItem(key);
    if (cached) {
      setFindings(JSON.parse(cached));
      return undefined;
    }
    const controller = new AbortController();
    // After the map has settled: the findings are not urgent.
    const timer = setTimeout(() => {
      loadFindings(devices, positions, controller.signal)
        .then((result) => {
          window.sessionStorage.setItem(key, JSON.stringify(result));
          setFindings(result);
        })
        .catch(() => {});
    }, 2500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Once per day and fleet size, not on every position.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [readonly, disableReports, deviceCount, userId, hiddenOn]);

  if (!findings?.length || hiddenOn === todayKey()) return null;

  const text = (finding, part) => {
    // One vehicle reads differently from several ("של X", not "ב-1 רכבים").
    const one = finding.values.vehicles === 1 ? t(`insight${part}_${finding.kind}One`) : null;
    let value = one || t(`insight${part}_${finding.kind}`);
    Object.entries(finding.values).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, replacement);
    });
    return value;
  };

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
