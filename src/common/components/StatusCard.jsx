import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Button,
  Card,
  Divider,
  Typography,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  CardMedia,
  Link,
  Tooltip,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import { glass, statusColor } from '../theme/surfaces';
import DeviceTile from './brand/DeviceTile';
import TelemetryStrip from './telemetry/TelemetryStrip';
import { setStatusCardElement, statusCardMoved } from './statusCardArea';
import { useTranslation } from './LocalizationProvider';
import PositionValue from './PositionValue';
import FaultCodes from '../../fleet/components/FaultCodes';
import { faultCodes } from '../fleet/fleetFields';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';
import { formatSpeed } from '../util/formatter';
import useActivityText from './useActivityText';
import { whatsappLink } from '../fleet/dispatch';
import CommandDialog from './commands/CommandDialog';
import CommandStatus from './commands/CommandStatus';
import FocusedEventBanner from './FocusedEventBanner';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    ...glass(theme, 0.93),
    pointerEvents: 'auto',
    position: 'relative',
    width: 340,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.75, 1.25, 1, 2),
    color: theme.palette.text.primary,
    cursor: 'grab',
  },
  // Over a vehicle photo the header is a flat ink bar at the bottom (brand: no gradients).
  headerMedia: {
    color: theme.palette.common.white,
    backgroundColor: alpha(theme.palette.brand.ink, 0.72),
    alignItems: 'flex-end',
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: 700,
    lineHeight: 1.25,
  },
  subline: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: 2,
    minWidth: 0,
  },
  plate: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    paddingInline: 8,
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.surface.sunken,
    color: theme.palette.text.primary,
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },
  media: {
    height: theme.dimensions.popupImageHeight,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  content: {
    padding: theme.spacing(0.5, 2, 1.5),
    maxHeight: theme.dimensions.cardContentMaxHeight,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
    gap: theme.spacing(1.5),
    alignItems: 'baseline',
    paddingBlock: 4,
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  rowValue: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  details: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginTop: theme.spacing(0.5),
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 2, 1),
  },
  action: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 52,
    paddingBlock: theme.spacing(0.75),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    color: theme.palette.primary.main,
    fontSize: '0.6875rem',
    fontWeight: 600,
    lineHeight: 1.2,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-disabled': {
      borderColor: theme.palette.surface.border,
      color: theme.palette.text.disabled,
    },
  },
  primaryAction: {
    display: 'flex',
    margin: theme.spacing(0, 2, 2),
    width: `calc(100% - ${theme.spacing(4)})`,
    height: 44,
    whiteSpace: 'nowrap',
  },
  driverLine: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0, 2, 0.5),
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
  success: { color: theme.palette.success.main },
  warning: { color: theme.palette.warning.main },
  error: { color: theme.palette.error.main },
  neutralText: { color: theme.palette.text.secondary },
  speedChip: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: theme.layers.statusCard,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + (var(--shell-rail, 0px) + ${desktopPadding}) / 2)`,
      bottom: `calc(${theme.spacing(3)} + env(safe-area-inset-bottom, 0px))`,
    },
    [theme.breakpoints.down('md')]: {
      left: '50%',
      bottom: `calc(${theme.spacing(2)} + var(--shell-bottom, 0px))`,
    },
    transform: 'translateX(-50%)',
  },
}));

const StatusCard = ({ deviceId, position, onClose, disableActions, desktopPadding = '0px' }) => {
  const { classes, cx, theme } = useStyles({ desktopPadding });
  const navigate = useNavigate();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const deviceReadonly = useDeviceReadonly();

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);

  const deviceImage = device?.attributes?.deviceImage;

  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference(
    'positionItems',
    'fixTime,address,speed,totalDistance',
  );

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);
  const [driverAnchor, setDriverAnchor] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const speedUnit = useAttributePreference('speedUnit');
  const { activity, label: activityLabel, tone } = useActivityText(device, position);
  const driverUniqueId = position?.attributes?.driverUniqueId;
  const driver = useSelector((state) =>
    driverUniqueId ? state.drivers.items[driverUniqueId] : null,
  );
  const driverName = driver?.name || driverUniqueId;
  const driverPhone = driver?.attributes?.phone;

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow('api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow('api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position, t]);

  const color = device ? statusColor(theme, device.status) : theme.palette.neutral.main;
  const moving = activity === 'moving';
  const plateNumber = device?.attributes?.plateNumber;

  const header = device && (
    <div className={cx(classes.header, deviceImage && classes.headerMedia)}>
      <DeviceTile category={device.category} status={device.status} size={36} />
      <div className={classes.titles}>
        <Typography variant="subtitle2" color="inherit" className={classes.title} noWrap>
          {device.name}
        </Typography>
        <div className={classes.subline}>
          {plateNumber && (
            <span className={classes.plate} dir="ltr">
              {plateNumber}
            </span>
          )}
          <Typography
            component="span"
            color={deviceImage ? 'inherit' : 'textSecondary'}
            className={cx(classes.status, !deviceImage && classes[tone])}
          >
            <span className={classes.dot} style={{ backgroundColor: color }} />
            {activityLabel}
            {moving && position && (
              <span className={classes.speedChip}>
                {' · '}
                {formatSpeed(position.speed, speedUnit, t)}
              </span>
            )}
          </Typography>
        </div>
      </div>
      <IconButton aria-label={t('a11yClose')} color="inherit" onClick={onClose}>
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </div>
  );

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: 'relative' }}
            onDragStop={statusCardMoved}
          >
            <Card elevation={0} className={classes.card} ref={setStatusCardElement}>
              {deviceImage ? (
                <CardMedia
                  className={cx('draggable-header', classes.media)}
                  image={`api/media/${device.uniqueId}/${deviceImage}`}
                >
                  {header}
                </CardMedia>
              ) : (
                <div className="draggable-header">{header}</div>
              )}
              {position && <TelemetryStrip position={position} device={device} />}
              {position && (
                <div className={classes.content}>
                  {positionItems
                    .split(',')
                    .filter(
                      (key) =>
                        key !== 'dtcs' &&
                        (position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key)),
                    )
                    .map((key) => (
                      <div className={classes.row} key={key}>
                        <span className={classes.rowLabel}>
                          {positionAttributes[key]?.name || key}
                        </span>
                        <span className={classes.rowValue}>
                          <PositionValue
                            position={position}
                            property={position.hasOwnProperty(key) ? key : null}
                            attribute={position.hasOwnProperty(key) ? null : key}
                          />
                        </span>
                      </div>
                    ))}
                  {faultCodes(position).length > 0 && (
                    <div className={classes.row}>
                      <span className={classes.rowLabel}>{t('fleetFaultCodes')}</span>
                      <span className={classes.rowValue}>
                        <FaultCodes position={position} />
                      </span>
                    </div>
                  )}
                  <Link
                    component={RouterLink}
                    to={`/position/${position.id}`}
                    underline="hover"
                    className={classes.details}
                  >
                    {t('sharedShowDetails')}
                  </Link>
                </div>
              )}
              {driverName && (
                <div className={classes.driverLine}>
                  <PersonRoundedIcon fontSize="inherit" />
                  {t('cardDriverName').replace('{0}', driverName)}
                </div>
              )}
              <FocusedEventBanner deviceId={deviceId} />
              <CommandStatus deviceId={deviceId} />
              <div className={classes.actions}>
                {moving ? (
                  <ButtonBase
                    className={classes.action}
                    onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                    disabled={disableActions || !position}
                  >
                    <RouteRoundedIcon fontSize="small" />
                    {t('cardReplay')}
                  </ButtonBase>
                ) : (
                  <ButtonBase
                    className={classes.action}
                    onClick={() => navigate(`/telemetry/${deviceId}`)}
                    disabled={disableActions || !position}
                  >
                    <SpeedRoundedIcon fontSize="small" />
                    {t('cardDials')}
                  </ButtonBase>
                )}
                <ButtonBase
                  className={classes.action}
                  onClick={() => setCommandOpen(true)}
                  disabled={disableActions}
                  aria-haspopup="dialog"
                >
                  <SendRoundedIcon fontSize="small" />
                  {t('cardCommand')}
                </ButtonBase>
                <Tooltip
                  title={
                    !driverName ? t('cardNoDriver') : !driverPhone ? t('cardNoDriverPhone') : ''
                  }
                  describeChild
                >
                  <span style={{ display: 'grid' }}>
                    <ButtonBase
                      className={classes.action}
                      onClick={(e) => setDriverAnchor(e.currentTarget)}
                      disabled={!driverPhone}
                      aria-haspopup="menu"
                    >
                      <PhoneRoundedIcon fontSize="small" />
                      {t('cardDriver')}
                    </ButtonBase>
                  </span>
                </Tooltip>
                <ButtonBase
                  className={classes.action}
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  aria-haspopup="menu"
                  aria-label={t('sharedExtra')}
                >
                  <MoreHorizRoundedIcon fontSize="small" />
                  {t('cardMore')}
                </ButtonBase>
              </div>
              <Button
                variant="contained"
                className={classes.primaryAction}
                startIcon={moving ? <SpeedRoundedIcon /> : <RouteRoundedIcon />}
                onClick={() =>
                  navigate(moving ? `/telemetry/${deviceId}` : `/replay?deviceId=${deviceId}`)
                }
                disabled={disableActions || !position}
              >
                {moving ? t('cardLiveDials') : t('cardReplayToday')}
              </Button>
            </Card>
          </Rnd>
        )}
      </div>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate(`/settings/device/${deviceId}`);
          }}
          disabled={disableActions || deviceReadonly}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('sharedEdit')}</ListItemText>
        </MenuItem>
        {position && !shareDisabled && !user.temporary && (
          <MenuItem onClick={() => navigate(`/settings/device/${deviceId}/share`)}>
            <ListItemIcon>
              <ShareRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('sharedShare')}</ListItemText>
          </MenuItem>
        )}
        {position && (
          <MenuItem
            onClick={() => navigate(`/stream?deviceId=${deviceId}`)}
            disabled={position.protocol !== 'jt808'}
          >
            <ListItemIcon>
              <VideocamRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('linkLiveVideo')}</ListItemText>
          </MenuItem>
        )}
        {position && !readonly && (
          <MenuItem onClick={handleGeofence}>
            <ListItemIcon>
              <HexagonRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('sharedCreateGeofence')}</ListItemText>
          </MenuItem>
        )}
        {position && <Divider />}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            <ListItemIcon>
              <OpenInNewRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('linkGoogleMaps')}</ListItemText>
          </MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            <ListItemIcon>
              <OpenInNewRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('linkAppleMaps')}</ListItemText>
          </MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            <ListItemIcon>
              <OpenInNewRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('linkStreetView')}</ListItemText>
          </MenuItem>
        )}
        {position && navigationAppTitle && navigationAppLink && (
          <MenuItem
            component="a"
            target="_blank"
            href={navigationAppLink
              .replace('{latitude}', position.latitude)
              .replace('{longitude}', position.longitude)}
          >
            <ListItemIcon>
              <OpenInNewRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{navigationAppTitle}</ListItemText>
          </MenuItem>
        )}
      </Menu>
      {commandOpen && <CommandDialog deviceId={deviceId} onClose={() => setCommandOpen(false)} />}
      <Menu
        anchorEl={driverAnchor}
        open={Boolean(driverAnchor)}
        onClose={() => setDriverAnchor(null)}
      >
        <MenuItem component="a" href={`tel:${driverPhone}`} onClick={() => setDriverAnchor(null)}>
          <ListItemIcon>
            <PhoneRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('cardCall')} secondary={<bdi dir="ltr">{driverPhone}</bdi>} />
        </MenuItem>
        <MenuItem
          component="a"
          target="_blank"
          rel="noopener"
          href={whatsappLink(
            driverPhone,
            t('cardWhatsappGreeting').replace('{0}', driverName || ''),
          )}
          onClick={() => setDriverAnchor(null)}
        >
          <ListItemIcon>
            <ChatRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('cardWhatsapp')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default StatusCard;
