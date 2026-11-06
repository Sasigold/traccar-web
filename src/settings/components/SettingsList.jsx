import { Link } from 'react-router-dom';
import { Avatar, ButtonBase, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { brandTile } from '../../common/theme/surfaces';

// Direction A settings list: a white card of rows, each with an ice icon tile,
// a title, a short description and a chevron. Rows are split by hairlines.
const useStyles = makeStyles()((theme) => ({
  card: {
    borderRadius: theme.tokens.radius.lg,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    width: '100%',
    minHeight: 60,
    padding: theme.spacing(1.25, 2),
    textAlign: 'start',
    transition: 'background-color 140ms ease',
    '&:hover, &.Mui-focusVisible': {
      backgroundColor: alpha(theme.palette.text.primary, 0.04),
    },
    '& + &': {
      borderTop: `1px solid ${theme.palette.surface.border}`,
    },
  },
  icon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.primary.main,
    '& svg': {
      fontSize: 20,
    },
  },
  text: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontWeight: 500,
    fontSize: '0.9375rem',
    lineHeight: 1.35,
  },
  description: {
    color: theme.palette.text.secondary,
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
  chevron: {
    color: theme.palette.text.secondary,
    fontSize: 20,
    flexShrink: 0,
  },
  profile: {
    gap: theme.spacing(1.75),
    padding: theme.spacing(1.75, 2),
  },
  avatar: {
    ...brandTile(),
    width: 46,
    height: 46,
    fontSize: '1rem',
    fontWeight: 600,
  },
  profileName: {
    fontWeight: 600,
    fontSize: '1rem',
  },
}));

// Points toward the inline end: left in RTL, right in LTR.
const ChevronIcon = ({ className, rtl }) =>
  rtl ? (
    <ChevronLeftRoundedIcon className={className} />
  ) : (
    <ChevronRightRoundedIcon className={className} />
  );

const rowLinkProps = ({ to, href }) =>
  href ? { component: 'a', href, target: '_blank', rel: 'noreferrer' } : { component: Link, to };

export const SettingsList = ({ items }) => {
  const { classes, theme } = useStyles();
  const rtl = theme.direction === 'rtl';
  return (
    <Paper elevation={0} className={classes.card} component="nav">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <ButtonBase key={item.id} className={classes.row} {...rowLinkProps(item)}>
            <span className={classes.icon}>{Icon && <Icon />}</span>
            <span className={classes.text}>
              <span className={classes.title}>{item.title}</span>
              {item.description && <span className={classes.description}>{item.description}</span>}
            </span>
            {item.href ? (
              <OpenInNewRoundedIcon className={classes.chevron} />
            ) : (
              <ChevronIcon className={classes.chevron} rtl={rtl} />
            )}
          </ButtonBase>
        );
      })}
    </Paper>
  );
};

export const SettingsProfileCard = ({ to, initial, name, detail }) => {
  const { classes, cx, theme } = useStyles();
  const rtl = theme.direction === 'rtl';
  return (
    <Paper elevation={0} className={classes.card}>
      <ButtonBase className={cx(classes.row, classes.profile)} component={Link} to={to}>
        <Avatar className={classes.avatar}>{initial}</Avatar>
        <span className={classes.text}>
          <Typography component="span" className={classes.profileName} noWrap>
            {name}
          </Typography>
          {detail && (
            <span className={classes.description} dir="auto">
              {detail}
            </span>
          )}
        </span>
        <ChevronIcon className={classes.chevron} rtl={rtl} />
      </ButtonBase>
    </Paper>
  );
};
