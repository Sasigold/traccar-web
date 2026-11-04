import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { glass } from '../../theme/surfaces';
import { formatNotificationTitle } from '../../util/formatter';
import { useTranslation } from '../LocalizationProvider';
import { eventsActions } from '../../../store';
import { eventIconKey, eventIcons } from '../../../map/core/preloadImages';

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
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(1),
  },
  item: {
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.lg,
    marginInline: 0,
    marginBottom: 2,
    paddingBlock: theme.spacing(1.25),
    '&:hover .delete': {
      opacity: 1,
    },
  },
  icon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    '& img': {
      width: 20,
      height: 20,
      filter: theme.palette.mode === 'dark' ? 'invert(1) brightness(1.2)' : 'none',
      opacity: 0.85,
    },
  },
  delete: {
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
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  },
}));

const EventsDrawer = ({ open, onClose }) => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);
  const events = useSelector((state) => state.events.items);

  const formatType = (event) =>
    formatNotificationTitle(t, {
      type: event.type,
      attributes: {
        alarms: event.attributes.alarm,
      },
    });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { className: classes.paper } }}
    >
      <div className={classes.header}>
        <Typography variant="h6" className={classes.title}>
          {t('reportEvents')}
          {events.length > 0 && <Chip size="small" label={events.length} color="primary" />}
        </Typography>
        {events.length > 0 && (
          <Tooltip title={t('shellClearAll')}>
            <IconButton size="small" onClick={() => dispatch(eventsActions.deleteAll())}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <IconButton aria-label={t('a11yClose')} size="small" onClick={onClose}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </div>
      {events.length === 0 ? (
        <div className={classes.empty}>
          <span className={classes.emptyIcon}>
            <NotificationsRoundedIcon />
          </span>
          <Typography variant="body2">{t('shellNoEvents')}</Typography>
        </div>
      ) : (
        <List className={classes.list} disablePadding>
          {events.map((event) => (
            <ListItemButton
              key={event.id}
              className={classes.item}
              onClick={() => navigate(`/event/${event.id}`)}
              disabled={!event.id}
            >
              <span className={classes.icon}>
                <img src={eventIcons[eventIconKey(event.type)]} alt="" />
              </span>
              <ListItemText
                primary={devices[event.deviceId]?.name}
                secondary={
                  <>
                    {formatType(event)}
                    {' · '}
                    {dayjs(event.eventTime).fromNow()}
                  </>
                }
                slotProps={{ primary: { noWrap: true, fontWeight: 600 } }}
              />
              <IconButton
                aria-label={t('sharedRemove')}
                size="small"
                className={cx(classes.delete, 'delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(eventsActions.delete(event));
                }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
        </List>
      )}
    </Drawer>
  );
};

export default EventsDrawer;
