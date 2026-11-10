import { Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { Link } from 'react-router-dom';

const useStyles = makeStyles()((theme, { tone, size }) => {
  const accent = tone === 'alert' ? theme.palette.error.main : theme.palette.primary.main;
  return {
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: size === 'lg' ? theme.spacing(2, 2.25) : theme.spacing(1.5, 2),
      borderRadius: theme.tokens.radius.lg,
      backgroundColor: theme.palette.surface.tint,
      border: `1px solid ${size === 'lg' ? theme.palette.surface.border : 'transparent'}`,
      color: theme.palette.text.primary,
      textDecoration: 'none',
      textAlign: 'start',
      minWidth: 0,
      transition: `border-color ${theme.tokens.motion.duration.fast}ms`,
      '&[href]:hover, &[href]:focus-visible': {
        borderColor: alpha(theme.palette.primary.main, 0.4),
      },
    },
    inline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    head: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
      '& svg': {
        fontSize: 20,
        color: accent,
      },
    },
    iconBox: {
      width: 38,
      height: 38,
      flexShrink: 0,
      borderRadius: theme.tokens.radius.md,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.background.paper,
      color: accent,
      '& svg': {
        fontSize: 20,
      },
    },
    text: {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
    },
    label: {
      fontWeight: 600,
      color: theme.palette.surface.textSecondaryOnTint,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    value: {
      ...(size === 'lg'
        ? theme.typography.h2
        : { fontSize: size === 'md' ? '1.5rem' : '1.25rem', fontWeight: 600, lineHeight: 1.2 }),
      color: tone === 'alert' ? theme.palette.error.main : theme.palette.text.primary,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    hint: {
      color: theme.palette.surface.textSecondaryOnTint,
    },
  };
});

// ADM-29: the one KPI tile (brand book: KPI cards sit on ice), shared by the service screens,
// the fleet hub and the reports. `to` makes it a link; an undefined value shows a skeleton.
// layout "stacked": label (with its icon) over the value; "inline": the icon in a box beside the
// value, the label under it (the reports' summary row). size: lg | md | sm.
const KpiTile = ({
  icon,
  label,
  value,
  hint,
  to,
  tone = 'default',
  wrapHint = false,
  size = 'lg',
  layout = 'stacked',
}) => {
  const { classes, cx } = useStyles({ tone, size });
  const Root = to ? Link : 'div';
  const shown =
    value === undefined ? <Skeleton width={56} sx={{ display: 'inline-block' }} /> : value;
  const labelText = (
    <Typography variant={layout === 'inline' ? 'caption' : 'body2'} className={classes.label}>
      {label}
    </Typography>
  );
  return (
    <Root
      className={cx(classes.root, layout === 'inline' && classes.inline)}
      {...(to ? { to } : {})}
    >
      {layout === 'inline' ? (
        <>
          {icon && <span className={classes.iconBox}>{icon}</span>}
          <span className={classes.text}>
            <span className={classes.value}>{shown}</span>
            {labelText}
          </span>
        </>
      ) : (
        <>
          <span className={classes.head}>
            {icon}
            {labelText}
          </span>
          <span className={classes.value}>{shown}</span>
          {hint && (
            <Typography variant="caption" className={classes.hint} noWrap={!wrapHint}>
              {hint}
            </Typography>
          )}
        </>
      )}
    </Root>
  );
};

export default KpiTile;
