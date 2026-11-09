import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { Button, IconButton, LinearProgress, Paper, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { getFleetClient } from '../../common/fleet/client';
import { useFleetProfile, useFleetReady } from '../../common/fleet/useFleet';
import { setupProgress, setupSteps } from '../../common/fleet/fleetSetup';
import usePersistedState from '../../common/util/usePersistedState';

const useStyles = makeStyles()((theme) => ({
  card: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  progress: {
    height: 6,
    borderRadius: theme.tokens.radius.pill,
    backgroundColor:
      theme.palette.mode === 'dark' ? theme.palette.surface.sunken : theme.palette.brand.ice,
    '& .MuiLinearProgress-bar': {
      borderRadius: theme.tokens.radius.pill,
      backgroundColor: theme.palette.cta.main,
    },
  },
  steps: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
    gap: theme.spacing(0.5, 2),
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: 40,
  },
  done: {
    color: theme.palette.success.main,
  },
  todo: {
    color: theme.palette.text.disabled,
  },
  doneText: {
    color: theme.palette.text.secondary,
  },
  // Read by screen readers, not shown.
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
}));

const ROLES = ['owner', 'admin', 'manager'];

// Counts the setup steps read: Traccar from the store, the rest from the fleet database.
const useSetupCounts = (enabled) => {
  const devices = useSelector((state) => Object.keys(state.devices.items).length);
  const drivers = useSelector((state) => Object.keys(state.drivers.items).length);
  const maintenances = useSelector((state) => Object.keys(state.maintenances.items).length);
  const [database, setDatabase] = useState({});

  useAsyncTask(async () => {
    if (!enabled) {
      return;
    }
    const client = getFleetClient();
    const count = async (query) => {
      const { count: value, error } = await query;
      return error ? undefined : value;
    };
    const head = { count: 'exact', head: true };
    const [assignments, users, recipients, templates] = await Promise.all([
      count(client.from('vehicle_driver_assignments').select('id', head).is('ends_at', null)),
      count(client.from('profiles').select('id', head)),
      count(client.from('alert_recipients').select('id', head)),
      count(client.from('inspection_templates').select('id', head)),
    ]);
    setDatabase({ assignments, users, recipients, templates });
  }, [enabled]);

  return useMemo(
    () => ({ devices, drivers, maintenances, ...database }),
    [devices, drivers, maintenances, database],
  );
};

// "Set up your fleet" (ADM-01): the seven steps of a new account, with the progress from the
// data and one main action for the next step (outlined with `quiet`, on screens that already
// have their own main action). Owners and managers see it until it is done or they close it.
const FleetSetupCard = ({ className, quiet = false }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const ready = useFleetReady();
  const profile = useFleetProfile();
  const permissions = useSelector((state) => state.fleet.permissions);
  const [dismissed, setDismissed] = usePersistedState('fleetSetupDismissed', []);

  const visible =
    ready && profile && ROLES.includes(profile.role) && !dismissed.includes(profile.org_id);
  const counts = useSetupCounts(visible);
  const steps = setupSteps(counts, (permission) => permissions.includes(permission));
  const progress = setupProgress(steps);

  if (!visible || progress.complete || !steps.every((step) => step.known)) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      className={cx(classes.card, className)}
      component="section"
      aria-labelledby="fleet-setup-title"
    >
      <div className={classes.head}>
        <div>
          <Typography variant="subtitle1" fontWeight={700} component="h2" id="fleet-setup-title">
            {t('setupTitle')}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {t('setupProgress').replace('{0}', progress.done).replace('{1}', progress.total)}
          </Typography>
        </div>
        <Tooltip title={t('setupDismiss')}>
          <IconButton
            size="small"
            aria-label={t('setupDismiss')}
            onClick={() => setDismissed([...dismissed, profile.org_id])}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      <LinearProgress
        variant="determinate"
        value={(progress.done / progress.total) * 100}
        className={classes.progress}
        aria-label={t('setupTitle')}
      />
      <ol className={classes.steps}>
        {steps.map((step) => (
          <li key={step.id} className={classes.step}>
            {step.done ? (
              <CheckCircleRoundedIcon className={classes.done} fontSize="small" />
            ) : (
              <RadioButtonUncheckedRoundedIcon className={classes.todo} fontSize="small" />
            )}
            {step === progress.next ? (
              <>
                <Typography variant="body2" fontWeight={600}>
                  {t(`setupStep${step.id.replace(/^\w/, (c) => c.toUpperCase())}`)}
                </Typography>
                <Button
                  variant={quiet ? 'outlined' : 'contained'}
                  size="small"
                  component={RouterLink}
                  to={step.path}
                  aria-label={`${t('setupContinue')}: ${t(`setupStep${step.id.replace(/^\w/, (c) => c.toUpperCase())}`)}`}
                >
                  {t('setupContinue')}
                </Button>
              </>
            ) : (
              <Typography
                variant="body2"
                component={step.done ? 'span' : RouterLink}
                to={step.done ? undefined : step.path}
                className={step.done ? classes.doneText : undefined}
                color={step.done ? undefined : 'primary'}
              >
                {t(`setupStep${step.id.replace(/^\w/, (c) => c.toUpperCase())}`)}
                {step.done && <span className={classes.hidden}>{` · ${t('setupDone')}`}</span>}
              </Typography>
            )}
          </li>
        ))}
      </ol>
    </Paper>
  );
};

export default FleetSetupCard;
