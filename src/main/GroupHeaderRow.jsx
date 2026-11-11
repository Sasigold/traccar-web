import { ButtonBase, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { statusColor } from '../common/theme/surfaces';
import DeviceRow from './DeviceRow';

const useStyles = makeStyles()((theme) => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0, 2),
    justifyContent: 'flex-start',
    textAlign: 'start',
    color: theme.palette.text.primary,
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '&:hover': { backgroundColor: theme.palette.action.hover },
  },
  chevron: {
    color: theme.palette.text.secondary,
    transition: `transform ${theme.tokens.motion.duration.fast}ms`,
  },
  collapsed: {
    transform: 'rotate(90deg)',
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  counts: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginInlineEnd: 4,
  },
}));

const GroupHeader = ({ row, style, onToggle }) => {
  const { classes, cx, theme } = useStyles();
  const t = useTranslation();
  const name = row.name || t('groupNone');
  return (
    <div style={style}>
      <ButtonBase
        className={classes.header}
        style={{ height: '100%' }}
        aria-expanded={!row.collapsed}
        aria-label={`${name}: ${t('groupHeaderCount').replace('{0}', String(row.count))}`}
        onClick={() => onToggle(row.groupId)}
      >
        <ExpandMoreRoundedIcon
          fontSize="small"
          className={cx(classes.chevron, row.collapsed && classes.collapsed)}
        />
        <Typography variant="body2" className={classes.name}>
          {name}
        </Typography>
        <span className={classes.counts} aria-hidden="true">
          <Typography variant="caption">{row.count}</Typography>
          {row.online > 0 && (
            <Typography variant="caption">
              <span
                className={classes.dot}
                style={{ backgroundColor: statusColor(theme, 'online') }}
              />
              {row.online}
            </Typography>
          )}
          {row.offline > 0 && (
            <Typography variant="caption">
              <span
                className={classes.dot}
                style={{ backgroundColor: statusColor(theme, 'offline') }}
              />
              {row.offline}
            </Typography>
          )}
        </span>
      </ButtonBase>
    </div>
  );
};

// LIV-22: a row of the grouped list: a group header, or a vehicle row.
const GroupHeaderRow = ({ index, style, rows, onToggle, ...rowProps }) => {
  const row = rows[index];
  if (row.type === 'group') {
    return <GroupHeader row={row} style={style} onToggle={onToggle} />;
  }
  return <DeviceRow {...rowProps} index={row.index} style={style} />;
};

export default GroupHeaderRow;
