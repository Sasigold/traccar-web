import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
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
const CommandDialog = ({ deviceId, onClose }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const sendCommand = useSendCommand();
  const limitCommands = useRestriction('limitCommands');

  const device = useSelector((state) => state.devices.items[deviceId]);

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
      const response = await fetchOrThrow(
        `api/commands/types?${new URLSearchParams({ deviceId }).toString()}`,
        { signal },
      );
      const supported = new Set((await response.json()).map((it) => it.type));
      const available = QUICK_COMMANDS.filter((type) => supported.has(type));
      setQuickTypes(available);
      if (!available.length) {
        setChoice('other');
      }
    },
    [deviceId, limitCommands],
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
  const confirmed = !dangerous || confirmationMatches(confirmation, target.value);

  const handleChoice = (value) => {
    setChoice(value);
    setConfirmation('');
  };

  const handleSend = useCatch(async () => {
    setSending(true);
    try {
      await sendCommand(Number(deviceId), command);
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
          if (command && confirmed && !sending) {
            handleSend();
          }
        }}
      >
        <DialogTitle id="command-dialog-title">
          {t('commandDialogTitle')}
          {device && (
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
                deviceId={deviceId}
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
          {dangerous && (
            <EngineStopConfirm
              deviceId={deviceId}
              value={confirmation}
              onChange={setConfirmation}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('sharedCancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            color={dangerous ? 'error' : 'primary'}
            disabled={!command || !confirmed || sending}
          >
            {dangerous ? t('commandEngineStop') : t('commandSend')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CommandDialog;
