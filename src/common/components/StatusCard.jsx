import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Card,
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
import { glass, statusColor } from '../theme/surfaces';
import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import PositionValue from './PositionValue';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';
import { formatStatus } from '../util/formatter';
import { mapIconKey, mapIcons } from '../../map/core/preloadImages';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    ...glass(theme, 0.93),
    pointerEvents: 'auto',
    position: 'relative',
    width: theme.dimensions.popupMaxWidth,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      insetInline: 20,
      top: 0,
      height: 2,
      borderRadius: 2,
      background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 70%, transparent)`,
      zIndex: 1,
    },
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
    background: `linear-gradient(180deg, ${alpha('#0b1020', 0.1)} 0%, ${alpha('#0b1020', 0.65)} 100%)`,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& img': {
      width: 20,
      height: 20,
      filter: 'brightness(0) invert(1)',
    },
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: 700,
    lineHeight: 1.25,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.75rem',
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
    justifyContent: 'space-between',
    margin: theme.spacing(0, 1.25, 1.25),
    padding: theme.spacing(0.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
    border: `1px solid ${theme.palette.surface.border}`,
  },
  action: {
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
    },
  },
  danger: {
    '&:hover': {
      color: theme.palette.error.main,
      backgroundColor: alpha(theme.palette.error.main, 0.1),
    },
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: theme.layers.statusCard,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + (var(--shell-rail, 0px) + ${desktopPadding}) / 2)`,
      bottom: theme.spacing(3),
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

  const header = device && (
    <div className={cx(classes.header, deviceImage && classes.headerMedia)}>
      <span className={classes.avatar} style={{ backgroundColor: color }}>
        <img src={mapIcons[mapIconKey(device.category)]} alt="" />
      </span>
      <div className={classes.titles}>
        <Typography variant="subtitle2" color="inherit" className={classes.title} noWrap>
          {device.name}
        </Typography>
        <Typography
          component="span"
          color={deviceImage ? 'inherit' : 'textSecondary'}
          className={classes.status}
        >
          <span className={classes.dot} style={{ backgroundColor: color }} />
          {formatStatus(device.status, t)}
        </Typography>
      </div>
      <IconButton size="small" color="inherit" onClick={onClose} onTouchStart={onClose}>
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
              {position && (
                <div className={classes.content}>
                  {positionItems
                    .split(',')
                    .filter(
                      (key) =>
                        position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key),
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
                <Tooltip title={t('sharedExtra')}>
                  <span>
                    <IconButton
                      size="small"
                      className={classes.action}
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                      disabled={!position}
                    >
                      <MoreHorizRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('reportReplay')}>
                  <span>
                    <IconButton
                      size="small"
                      className={classes.action}
                      onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                      disabled={disableActions || !position}
                    >
                      <RouteRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('commandTitle')}>
                  <span>
                    <IconButton
                      size="small"
                      className={classes.action}
                      onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                      disabled={disableActions}
                    >
                      <SendRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('sharedEdit')}>
                  <span>
                    <IconButton
                      size="small"
                      className={classes.action}
                      onClick={() => navigate(`/settings/device/${deviceId}`)}
                      disabled={disableActions || deviceReadonly}
                    >
                      <EditRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('sharedRemove')}>
                  <span>
                    <IconButton
                      size="small"
                      className={cx(classes.action, classes.danger)}
                      onClick={() => setRemoving(true)}
                      disabled={disableActions || deviceReadonly}
                    >
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            </Card>
          </Rnd>
        )}
      </div>
      {position && (
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem
            onClick={() => navigate(`/stream?deviceId=${deviceId}`)}
            disabled={position.protocol !== 'jt808'}
          >
            <ListItemIcon>
              <VideocamRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('linkLiveVideo')}</ListItemText>
          </MenuItem>
          {!readonly && (
            <MenuItem onClick={handleGeofence}>
              <ListItemIcon>
                <HexagonRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('sharedCreateGeofence')}</ListItemText>
            </MenuItem>
          )}
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
          {navigationAppTitle && navigationAppLink && (
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
          {!shareDisabled && !user.temporary && (
            <MenuItem onClick={() => navigate(`/settings/device/${deviceId}/share`)}>
              <ListItemIcon>
                <ShareRoundedIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>{t('sharedShare')}</ListItemText>
            </MenuItem>
          )}
        </Menu>
      )}
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
