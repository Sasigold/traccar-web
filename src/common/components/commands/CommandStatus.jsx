import { useDispatch, useSelector } from 'react-redux';
import { IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { commandsActions } from '../../../store';
import { useTranslation } from '../LocalizationProvider';
import { formatTime } from '../../util/formatter';
import { prefixString } from '../../util/stringUtils';
import { commandStatusVisible } from '../../util/commands';
import useMinuteNow from '../../util/useMinuteNow';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    margin: theme.spacing(0, 2, 1),
    paddingBlock: 2,
    paddingInlineStart: theme.spacing(1),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    lineHeight: 1.35,
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  answered: {
    color: theme.palette.success.main,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  result: {
    display: 'block',
    color: theme.palette.text.primary,
    overflowWrap: 'anywhere',
  },
}));

// The last command's progress on the vehicle card: sent, queued, delivered, answered.
const CommandStatus = ({ deviceId }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const now = useMinuteNow();
  const item = useSelector((state) => state.commands.items[deviceId]);

  if (!commandStatusVisible(item, now)) {
    return null;
  }

  const name = item.description || t(prefixString('command', item.type || 'custom'));
  const sentAt = formatTime(item.sentAt, 'clock');
  let text;
  switch (item.status) {
    case 'queued':
      text = t('commandStatusQueued').replace('{0}', sentAt);
      break;
    case 'delivered':
      text = t('commandStatusDelivered');
      break;
    case 'answered':
      text = t('commandStatusAnswered').replace('{0}', formatTime(item.answeredAt, 'clock'));
      break;
    default:
      text = t('commandStatusSent').replace('{0}', sentAt);
  }
  const answered = item.status === 'answered';
  const Icon = answered ? CheckCircleRoundedIcon : HourglassTopRoundedIcon;

  return (
    <div className={classes.root} role="status">
      <Icon className={cx(classes.icon, answered && classes.answered)} aria-hidden />
      <span className={classes.text}>
        <span className={classes.name}>{name}</span>
        {' · '}
        {text}
        {answered && item.result && (
          <>
            {' '}
            <bdi className={classes.result}>{item.result}</bdi>
          </>
        )}
      </span>
      <IconButton
        size="small"
        aria-label={t('commandStatusHide')}
        onClick={() => dispatch(commandsActions.clear(deviceId))}
      >
        <CloseRoundedIcon fontSize="inherit" />
      </IconButton>
    </div>
  );
};

export default CommandStatus;
