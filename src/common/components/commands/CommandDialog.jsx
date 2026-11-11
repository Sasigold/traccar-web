import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import PowerOffRoundedIcon from '@mui/icons-material/PowerOffRounded';
import PowerRoundedIcon from '@mui/icons-material/PowerRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useTranslation } from '../LocalizationProvider';
import BaseCommandView from '../../../settings/components/BaseCommandView';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';
import { useRestriction } from '../../util/permissions';
import { prefixString } from '../../util/stringUtils';
import {
  QUICK_COMMANDS,
  confirmationMatches,
  confirmationTarget,
  isDangerousCommand,
} from '../../util/commands';
import useSendCommand from './useSendCommand';
import EngineStopConfirm from './EngineStopConfirm';

const icons = {
  positionSingle: MyLocationRoundedIcon,
  engineStop: PowerOffRoundedIcon,
  engineResume: PowerRoundedIcon,
};

const useStyles = makeStyles()((theme) => ({
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: '0.8125rem',
    fontWeight: 500,
  },
  plate: {
    paddingInline: 6,
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.surface.sunken,
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: theme.spacing(-1),
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 72,
    padding: theme.spacing(1),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    color: theme.palette.primary.main,
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: 1.25,
    textAlign: 'center',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.06),
    },
  },
  tileSelected: {
    borderColor: theme.palette.primary.main,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
  tileDanger: {
    color: theme.palette.error.main,
  },
  tileDangerSelected: {
    borderColor: theme.palette.error.main,
    boxShadow: `inset 0 0 0 1px ${theme.palette.error.main}`,
    backgroundColor: alpha(theme.palette.error.main, 0.08),
  },
  other: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

// Sends a command without leaving the map. Common commands are large buttons; engine stop asks
// for the plate number and warns when the vehicle is moving.
// LIV-25: with `deviceIds`, one command to several vehicles: only the commands all of them
// support, and never engine stop (that stays one vehicle at a time, with its plate typed).
const CommandDialog = ({ deviceId, deviceIds, onClose }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const sendCommand = useSendCommand();
  const limitCommands = useRestriction('limitCommands');

  const ids = deviceIds?.length ? deviceIds.map(Number) : [Number(deviceId)];
  const group = ids.length > 1;
  const firstId = ids[0];
  const idsKey = ids.join(',');
  const device = useSelector((state) => state.devices.items[firstId]);

  const [quickTypes, setQuickTypes] = useState(null);
  const [choice, setChoice] = useState(null);
  const [item, setItem] = useState({});
  const [savedId, setSavedId] = useState(0);
  const [savedCommand, setSavedCommand] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [sending, setSending] = useState(false);

  useAsyncTask(
    async ({ signal }) => {
      if (limitCommands) {
        setQuickTypes([]);
        setChoice('other');
        return;
      }
      // The commands every chosen vehicle supports.
      const list = idsKey.split(',').map(Number);
      const lists = await Promise.all(
        list.slice(0, 50).map(async (id) => {
          const response = await fetchOrThrow(
            `api/commands/types?${new URLSearchParams({ deviceId: id }).toString()}`,
            { signal },
          );
          return new Set((await response.json()).map((it) => it.type));
        }),
      );
      const available = QUICK_COMMANDS.filter(
        (type) =>
          lists.every((supported) => supported.has(type)) &&
          !(list.length > 1 && isDangerousCommand(type)),
      );
      setQuickTypes(available);
      if (!available.length) {
        setChoice('other');
      }
    },
    [idsKey, limitCommands],
  );

  // A saved command can be an engine stop too: read its type before it can be sent.
  useAsyncTask(
    async ({ signal }) => {
      setSavedCommand(null);
      if (savedId) {
        const response = await fetchOrThrow(`api/commands/${savedId}`, { signal });
        setSavedCommand(await response.json());
      }
    },
    [savedId],
  );

  const command = (() => {
    if (choice && choice !== 'other') {
      return { type: choice, attributes: {} };
    }
    if (choice === 'other') {
      if (savedId) {
        return savedCommand;
      }
      return item?.type ? item : null;
    }
    return null;
  })();

  const dangerous = isDangerousCommand(command?.type);
  const target = confirmationTarget(device);
  const confirmed = !group && (!dangerous || confirmationMatches(confirmation, target.value));
  // In a group a dangerous command is refused outright.
  const groupConfirmed = group ? !dangerous : confirmed;

  const handleChoice = (value) => {
    setChoice(value);
    setConfirmation('');
  };

  const handleSend = useCatch(async () => {
    setSending(true);
    try {
      if (group) {
        const results = await Promise.allSettled(ids.map((id) => sendCommand(id, command)));
        const failed = results.filter((result) => result.status === 'rejected').length;
        if (failed) {
          throw Error(
            t('commandGroupFailed')
              .replace('{0}', String(failed))
              .replace('{1}', String(ids.length)),
          );
        }
      } else {
        await sendCommand(Number(firstId), command);
      }
      onClose();
    } finally {
      setSending(false);
    }
  });

  const tile = (value, Icon, label, danger) => {
    const selected = choice === value;
    return (
      <ButtonBase
        key={value}
        role="radio"
        aria-checked={selected}
        className={cx(
          classes.tile,
          danger && classes.tileDanger,
          selected && (danger ? classes.tileDangerSelected : classes.tileSelected),
        )}
        onClick={() => handleChoice(value)}
      >
        <Icon />
        {label}
      </ButtonBase>
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="command-dialog-title">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (command && groupConfirmed && !sending) {
            handleSend();
          }
        }}
      >
        <DialogTitle id="command-dialog-title">
          {t('commandDialogTitle')}
          {group && (
            <Typography component="span" className={classes.subtitle}>
              {t('commandGroupCount').replace('{0}', String(ids.length))}
            </Typography>
          )}
          {!group && device && (
            <Typography component="span" className={classes.subtitle}>
              {device.name}
              {device.attributes?.plateNumber && (
                <span className={classes.plate} dir="ltr">
                  {device.attributes.plateNumber}
                </span>
              )}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent className={classes.content}>
          {quickTypes?.length > 0 && (
            <>
              <span className={classes.label} id="command-quick-label">
                {t('commandQuick')}
              </span>
              <div
                className={classes.tiles}
                role="radiogroup"
                aria-labelledby="command-quick-label"
              >
                {quickTypes.map((type) =>
                  tile(
                    type,
                    icons[type],
                    t(prefixString('command', type)),
                    isDangerousCommand(type),
                  ),
                )}
                {tile('other', TuneRoundedIcon, t('commandOther'), false)}
              </div>
            </>
          )}
          {choice === 'other' && (
            <div className={classes.other}>
              <BaseCommandView
                deviceId={firstId}
                item={item}
                setItem={setItem}
                includeSaved
                savedId={savedId}
                setSavedId={(value) => {
                  setSavedId(value);
                  setConfirmation('');
                }}
              />
            </div>
          )}
          {group && dangerous && <Alert severity="warning">{t('commandGroupNoEngineStop')}</Alert>}
          {!group && dangerous && (
            <EngineStopConfirm deviceId={firstId} value={confirmation} onChange={setConfirmation} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('sharedCancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            color={dangerous ? 'error' : 'primary'}
            disabled={!command || !groupConfirmed || sending}
          >
            {group
              ? t('commandSendGroup').replace('{0}', String(ids.length))
              : dangerous
                ? t('commandEngineStop')
                : t('commandSend')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CommandDialog;
