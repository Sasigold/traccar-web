import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Button,
  Card,
  Divider,
  Typography,
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
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import { glass, statusColor } from '../theme/surfaces';
import DeviceTile from './brand/DeviceTile';
import TelemetryStrip from './telemetry/TelemetryStrip';
import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import PositionValue from './PositionValue';
import FaultCodes from '../../fleet/components/FaultCodes';
import { faultCodes } from '../fleet/fleetFields';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';
import { formatStatus } from '../util/formatter';

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
  headerMedia: {
    color: theme.palette.common.white,
    background: `linear-gradient(180deg, ${alpha(theme.palette.brand.ink, 0.1)} 0%, ${alpha(theme.palette.brand.ink, 0.65)} 100%)`,
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
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 2, 2),
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-disabled': {
      borderColor: theme.palette.surface.border,
    },
  },
  primaryAction: {
    marginInlineStart: 'auto',
    height: 40,
    whiteSpace: 'nowrap',
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
  const dispatch = useDispatch();
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

  const [removing, setRemoving] = useState(false);

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetchOrThrow('api/devices');
      dispatch(devicesActions.refresh(await response.json()));
    }
    setRemoving(false);
  });

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
            className={classes.status}
          >
            <span className={classes.dot} style={{ backgroundColor: color }} />
            {formatStatus(device.status, t)}
          </Typography>
        </div>
      </div>
      <IconButton
        aria-label={t('a11yClose')}
        size="small"
        color="inherit"
        onClick={onClose}
        onTouchStart={onClose}
      >
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
          >
            <Card elevation={0} className={classes.card}>
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
              <div className={classes.actions}>
                <Tooltip title={t('reportReplay')} describeChild>
                  <span>
                    <IconButton
                      aria-label={t('reportReplay')}
                      className={classes.action}
                      onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                      disabled={disableActions || !position}
                    >
                      <RouteRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('commandTitle')} describeChild>
                  <span>
                    <IconButton
                      aria-label={t('commandTitle')}
                      className={classes.action}
                      onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                      disabled={disableActions}
                    >
                      <SendRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('sharedExtra')} describeChild>
                  <span>
                    <IconButton
                      aria-label={t('sharedExtra')}
                      className={classes.action}
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                    >
                      <MoreHorizRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button
                  variant="contained"
                  className={classes.primaryAction}
                  startIcon={<SpeedRoundedIcon />}
                  onClick={() => navigate(`/telemetry/${deviceId}`)}
                  disabled={disableActions || !position}
                >
                  {t('telemetryTitle')}
                </Button>
              </div>
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
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setRemoving(true);
          }}
          disabled={disableActions || deviceReadonly}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('sharedRemove')}</ListItemText>
        </MenuItem>
      </Menu>
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;
