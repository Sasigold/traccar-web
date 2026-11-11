import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import { glass } from '../../theme/surfaces';
import { formatNotificationTitle } from '../../util/formatter';
import { useTranslation } from '../LocalizationProvider';
import FleetAlertsBanner from '../../../fleet/components/FleetAlertsBanner';
import { devicesActions, eventsActions } from '../../../store';
import { storeLastSeen } from '../../../store/events';
import { useAttributePreference } from '../../util/preferences';
import { eventSeverity, eventTime } from '../../util/eventSeverity';
import { eventIconKey, eventIcons } from '../../../map/core/preloadImages';
import { useAlertCaseAccess, useAlertCases } from '../../fleet/useAlertCases';
import { slaState } from '../../fleet/alertCases';
import AlertCaseDialog from './AlertCaseDialog';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  paper: {
    ...glass(theme, 0.92),
    width: theme.dimensions.eventsDrawerWidth,
    maxWidth: 'calc(100vw - 32px)',
    margin: theme.spacing(2),
    marginTop: `calc(${theme.spacing(2)} + env(safe-area-inset-top, 0px))`,
    marginBottom: `calc(${theme.spacing(2)} + env(safe-area-inset-bottom, 0px))`,
    height: `calc(100% - ${theme.spacing(4)} - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
    borderRadius: theme.tokens.radius.xxl,
    display: 'flex',
    flexDirection: 'column',
  },
  // On desktop the list is a side panel under the top bar, so the bar (and the bell) stay usable.
  docked: {
    top: 'var(--shell-top, 0px)',
    height: `calc(100% - var(--shell-top, 0px) - ${theme.spacing(4)} - env(safe-area-inset-bottom, 0px))`,
    marginTop: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 1.5, 1.5, 2.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
  },
  title: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontWeight: 600,
  },
  cleared: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    margin: theme.spacing(1, 1.5, 0),
    padding: theme.spacing(0.5, 0.5, 0.5, 1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
    fontSize: '0.875rem',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2, 0.5),
  },
  grouped: {
    marginInlineStart: 'auto',
  },
  groupedOn: {
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
  subheader: {
    lineHeight: '28px',
    paddingInline: theme.spacing(1),
    backgroundColor: 'transparent',
    fontWeight: 600,
  },
  severity: {
    position: 'absolute',
    insetBlockStart: 8,
    insetInlineStart: 8,
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  critical: { backgroundColor: theme.palette.error.main },
  warning: { backgroundColor: theme.palette.warning.main },
  unread: {
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(1),
  },
  // The remove button sits beside the row's button, not inside it (no nested controls).
  row: {
    position: 'relative',
    listStyle: 'none',
    '&:hover .delete, &:focus-within .delete': {
      opacity: 1,
    },
  },
  item: {
    alignItems: 'flex-start',
    paddingInlineEnd: theme.spacing(6),
    gap: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.lg,
    marginInline: 0,
    marginBottom: 2,
    paddingBlock: theme.spacing(1.25),
  },
  icon: {
    position: 'relative',
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    // BRD-07: the event's icon as a mask in the theme's color, not an image inverted for dark.
    '& .vf-event-glyph': {
      width: 20,
      height: 20,
      backgroundColor: theme.palette.primary.main,
      maskSize: 'contain',
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
    },
  },
  // LIV-24: the handling chip: status, and the countdown to the response target.
  withCase: {
    paddingBottom: theme.spacing(5),
  },
  caseChip: {
    position: 'absolute',
    insetBlockEnd: theme.spacing(1.25),
    insetInlineStart: theme.spacing(7.5),
  },
  delete: {
    position: 'absolute',
    insetBlockStart: theme.spacing(1),
    insetInlineEnd: theme.spacing(1),
    opacity: 0,
    transition: 'opacity 140ms ease',
    '@media (hover: none)': {
      opacity: 1,
    },
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.tokens.radius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  },
}));

const FILTERS = ['all', 'critical', 'warning'];

// The alerts list. On desktop it is a side panel that leaves the map usable (no backdrop); on
// phones a drawer. Opening it marks everything as seen. A click on an alert selects the vehicle
// and shows the alert on its card.
const EventsDrawer = ({ open, onClose }) => {
  const { classes, cx, theme } = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const devices = useSelector((state) => state.devices.items);
  const events = useSelector((state) => state.events.items);
  const lastSeen = useSelector((state) => state.events.lastSeen);
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');
  const soundEvents = useAttributePreference('soundEvents', '');

  const [filter, setFilter] = useState('all');
  const caseAccess = useAlertCaseAccess();
  const { byEvent, slaMinutes, people } = useAlertCases(7, caseAccess && open);
  const [handling, setHandling] = useState(null);
  // The countdown moves on its own while the list is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || !caseAccess) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [open, caseAccess]);

  const caseChip = (event) => {
    const item = byEvent.get(Number(event.id));
    const status = item?.status || 'new';
    const sla = slaState(event.eventTime, status, slaMinutes, now);
    const label =
      status === 'in_progress'
        ? t('alertCaseInProgress')
        : status === 'closed'
          ? t('alertCaseClosed')
          : sla.kind === 'late'
            ? t('alertCaseLate').replace('{0}', sla.minutes)
            : t('alertCaseDue').replace('{0}', sla.minutes);
    return {
      label,
      color:
        status === 'new' && sla.kind === 'late'
          ? 'error'
          : status === 'closed'
            ? 'success'
            : 'default',
      variant: status === 'in_progress' || sla.kind === 'late' ? 'filled' : 'outlined',
    };
  };
  const [grouped, setGrouped] = useState(false);
  // What was unread when the list opened stays marked while it is open.
  const [seenBefore, setSeenBefore] = useState(lastSeen);

  useEffect(() => {
    if (open) {
      setSeenBefore(lastSeen);
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [open]);

  // Everything listed while the list is open counts as seen.
  const newest = events.length ? eventTime(events[0]) : 0;
  useEffect(() => {
    if (open && newest > lastSeen) {
      dispatch(eventsActions.markSeen(newest));
      storeLastSeen(newest);
    }
  }, [open, newest, lastSeen, dispatch]);

  const severityOf = (event) => eventSeverity(event, { soundAlarms, soundEvents });
  const shown = events.filter((event) => filter === 'all' || severityOf(event) === filter);

  const sections = grouped
    ? Object.values(
        shown.reduce((result, event) => {
          const key = event.deviceId;
          result[key] = result[key] || { key, title: devices[key]?.name || '', items: [] };
          result[key].items.push(event);
          return result;
        }, {}),
      )
    : [{ key: 'all', items: shown }];

  const formatType = (event) =>
    formatNotificationTitle(t, {
      type: event.type,
      attributes: {
        alarms: event.attributes.alarm,
      },
    });

  const openEvent = (event) => {
    dispatch(eventsActions.focus(event));
    dispatch(devicesActions.selectId(event.deviceId));
    navigate('/');
    if (!desktop) {
      onClose();
    }
  };

  // Clearing can be undone from the list itself while it stays open.
  const [cleared, setCleared] = useState(null);
  useEffect(() => {
    if (!open) {
      setCleared(null);
    }
  }, [open]);

  const clearAll = () => {
    setCleared(events);
    dispatch(eventsActions.deleteAll());
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant={desktop ? 'persistent' : 'temporary'}
      slotProps={{
        // Nothing of the list (or its fleet alerts) stays mounted while it is closed.
        transition: { unmountOnExit: true },
        paper: {
          className: cx(classes.paper, desktop && classes.docked),
          role: 'dialog',
          'aria-label': t('sharedNotifications'),
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onClose();
            }
          },
        },
      }}
    >
      <div className={classes.header}>
        <Typography variant="h6" component="h2" className={classes.title}>
          {t('sharedNotifications')}
          {events.length > 0 && <Chip size="small" label={events.length} color="primary" />}
        </Typography>
        {events.length > 0 && (
          <Tooltip title={t('shellClearAll')}>
            <IconButton size="small" aria-label={t('shellClearAll')} onClick={clearAll}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <IconButton aria-label={t('a11yClose')} size="small" onClick={onClose}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </div>
      <FleetAlertsBanner onNavigate={onClose} />
      {cleared && (
        <div className={classes.cleared} role="status">
          <span>
            {cleared.length === 1
              ? t('eventsClearedOne')
              : t('eventsCleared').replace('{0}', cleared.length)}
          </span>
          <Button
            size="small"
            onClick={() => {
              dispatch(eventsActions.restore(cleared));
              setCleared(null);
            }}
          >
            {t('sharedUndo')}
          </Button>
        </div>
      )}
      {events.length > 0 && (
        <div className={classes.filters} role="group" aria-label={t('sharedFilter')}>
          {FILTERS.map((value) => (
            <Chip
              key={value}
              size="small"
              label={t(
                {
                  all: 'sharedAll',
                  critical: 'eventSeverityCritical',
                  warning: 'eventSeverityWarning',
                }[value],
              )}
              color={filter === value ? 'primary' : 'default'}
              variant={filter === value ? 'filled' : 'outlined'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            />
          ))}
          <Tooltip title={t('eventGroupByVehicle')}>
            <IconButton
              size="small"
              className={cx(classes.grouped, grouped && classes.groupedOn)}
              aria-label={t('eventGroupByVehicle')}
              aria-pressed={grouped}
              onClick={() => setGrouped(!grouped)}
            >
              <ViewAgendaRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      )}
      {shown.length === 0 ? (
        <div className={classes.empty}>
          <span className={classes.emptyIcon}>
            <NotificationsRoundedIcon />
          </span>
          <Typography variant="body2">{t('shellNoEvents')}</Typography>
        </div>
      ) : (
        <List className={classes.list} disablePadding>
          {sections.map((section) => (
            <li key={section.key}>
              <ul style={{ padding: 0 }}>
                {grouped && (
                  <ListSubheader className={classes.subheader} disableSticky>
                    {section.title}
                  </ListSubheader>
                )}
                {section.items.map((event) => {
                  const severity = severityOf(event);
                  const unread = eventTime(event) > seenBefore;
                  return (
                    <li
                      key={event.id ?? `${event.deviceId}-${event.eventTime}`}
                      className={classes.row}
                    >
                      <ListItemButton
                        className={cx(
                          classes.item,
                          unread && classes.unread,
                          caseAccess && event.id && classes.withCase,
                        )}
                        onClick={() => openEvent(event)}
                      >
                        <span className={classes.icon}>
                          <span
                            className="vf-event-glyph"
                            aria-hidden="true"
                            style={{
                              maskImage: `url("${eventIcons[eventIconKey(event.type)]}")`,
                              WebkitMaskImage: `url("${eventIcons[eventIconKey(event.type)]}")`,
                            }}
                          />
                          {severity !== 'info' && (
                            <span className={cx(classes.severity, classes[severity])} />
                          )}
                        </span>
                        <ListItemText
                          primary={grouped ? formatType(event) : devices[event.deviceId]?.name}
                          secondary={
                            <>
                              {grouped ? null : (
                                <>
                                  {formatType(event)}
                                  {' · '}
                                </>
                              )}
                              {dayjs(event.eventTime).fromNow()}
                            </>
                          }
                          slotProps={{
                            primary: { noWrap: true, fontWeight: unread ? 700 : 600 },
                          }}
                        />
                      </ListItemButton>
                      {caseAccess && event.id && (
                        <Chip
                          size="small"
                          className={classes.caseChip}
                          {...caseChip(event)}
                          aria-label={`${t('alertCaseHandle')} · ${devices[event.deviceId]?.name || ''} · ${caseChip(event).label}`}
                          onClick={() => setHandling(event)}
                        />
                      )}
                      <IconButton
                        aria-label={`${t('sharedRemove')} · ${devices[event.deviceId]?.name || ''}`}
                        size="small"
                        className={cx(classes.delete, 'delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(eventsActions.delete(event));
                        }}
                      >
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </List>
      )}
      {handling && (
        <AlertCaseDialog
          event={handling}
          alertCase={byEvent.get(Number(handling.id))}
          people={people}
          onClose={() => setHandling(null)}
        />
      )}
    </Drawer>
  );
};

export default EventsDrawer;
