import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { aiErrorKey, explainCodes, vehiclesWithCode } from '../../common/fleet/ai';
import { useAiAvailable } from '../../common/fleet/useAi';
import { normalizePhone } from '../../common/util/israeliFields';

const useStyles = makeStyles()((theme) => ({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    paddingTop: theme.spacing(1),
  },
  card: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  code: {
    fontFamily: theme.tokens.font.mono,
    color: theme.palette.text.secondary,
  },
  title: {
    flex: 1,
    minWidth: 160,
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
}));

const SEVERITY_COLOR = { low: 'info', medium: 'warning', high: 'error', critical: 'error' };
const DRIVE_SEVERITY = { yes: 'success', caution: 'warning', no: 'error' };
const cap = (value) => value.replace(/^\w/, (c) => c.toUpperCase());

// AI-03: a fault code becomes a decision: what it is in plain Hebrew, how urgent, whether the
// vehicle can finish the day, what it may cost, and what to do next. Known codes come from the
// shared library; others are explained by the model once and kept there.
const FaultCodeDialog = ({ codes, deviceId, driverPhone, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const aiAvailable = useAiAvailable();
  const device = useSelector((state) => state.devices.items[deviceId]);
  const positions = useSelector((state) => state.session.positions);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const codeList = codes.join(',');
  useAsyncTask(async () => {
    const list = codeList.split(',');
    try {
      setItems(await explainCodes(list, { useModel: aiAvailable }));
    } catch (failure) {
      setError(failure);
      setItems(await explainCodes(list, { useModel: false }).catch(() => []));
    }
  }, [codeList, aiAvailable]);

  const shekels = (item) =>
    item.cost_max != null
      ? t('aiFaultCost')
          .replace('{0}', Number(item.cost_min).toLocaleString())
          .replace('{1}', Number(item.cost_max).toLocaleString())
      : null;

  const phone = normalizePhone(driverPhone);
  const driverText = (item) =>
    `${device?.name || ''}: ${item.title_he}. ${t(`aiFaultDrive${cap(item.drive_today)}`)}`;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('aiFaultTitle')}</DialogTitle>
      <DialogContent>
        <div className={classes.list}>
          {error && <Alert severity="info">{t(aiErrorKey(error))}</Alert>}
          {!items &&
            codes.map((code) => (
              <Skeleton key={code} variant="rounded" height={120} aria-label={t('sharedLoading')} />
            ))}
          {items?.map((item) =>
            item.unknown ? (
              <Paper key={item.code} elevation={0} className={classes.card}>
                <div className={classes.head}>
                  <span className={classes.code} dir="ltr">
                    {item.code}
                  </span>
                  <Typography className={classes.title}>{t('aiFaultUnknown')}</Typography>
                </div>
              </Paper>
            ) : (
              <Paper key={item.code} elevation={0} className={classes.card}>
                <div className={classes.head}>
                  <span className={classes.code} dir="ltr">
                    {item.code}
                  </span>
                  <Typography className={classes.title} component="h3">
                    {item.title_he}
                  </Typography>
                  <Chip
                    size="small"
                    color={SEVERITY_COLOR[item.severity]}
                    variant={item.severity === 'critical' ? 'filled' : 'outlined'}
                    label={t(`aiFaultSeverity${cap(item.severity)}`)}
                  />
                </div>
                <Alert severity={DRIVE_SEVERITY[item.drive_today]} role="status">
                  <strong>{t('aiFaultCanDrive')}</strong>{' '}
                  {t(`aiFaultDrive${cap(item.drive_today)}`)}
                </Alert>
                {item.explanation_he && (
                  <Typography variant="body2">{item.explanation_he}</Typography>
                )}
                {shekels(item) && (
                  <Typography variant="body2" color="textSecondary">
                    {shekels(item)}
                  </Typography>
                )}
                {deviceId && vehiclesWithCode(positions, item.code, deviceId) > 0 && (
                  <Typography variant="body2" color="textSecondary">
                    {t('aiFaultOthers').replace(
                      '{0}',
                      vehiclesWithCode(positions, item.code, deviceId),
                    )}
                  </Typography>
                )}
                <div className={classes.actions}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<BuildRoundedIcon />}
                    component={RouterLink}
                    to={`/fleet/work-order?${new URLSearchParams({
                      deviceId: deviceId || '',
                      type: 'repair',
                      title: `${item.code}: ${item.title_he}`,
                      notes: item.explanation_he || '',
                    })}`}
                    onClick={onClose}
                  >
                    {t('aiFaultWorkOrder')}
                  </Button>
                  {phone && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SendRoundedIcon />}
                      component="a"
                      href={`https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(driverText(item))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('aiFaultTellDriver')}
                    </Button>
                  )}
                </div>
                {item.source === 'ai' && (
                  <Typography variant="caption" color="textSecondary">
                    {t('aiFaultByAi')}
                  </Typography>
                )}
              </Paper>
            ),
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedHide')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FaultCodeDialog;
