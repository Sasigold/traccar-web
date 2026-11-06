import { Link } from 'react-router-dom';
import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.75),
    width: '100%',
    padding: theme.spacing(2, 2.25),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    textAlign: 'start',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
    '&:hover, &:focus-visible': {
      borderColor: alpha(theme.palette.primary.main, 0.45),
      boxShadow: theme.shadows[2],
      transform: 'translateY(-1px)',
    },
    '&:hover $chevron': {
      color: theme.palette.primary.main,
    },
  },
  icon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.primary.main,
  },
  text: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    fontWeight: 700,
  },
  chevron: {
    color: theme.palette.text.disabled,
    transition: 'color 160ms ease',
  },
}));

const SettingsCard = ({ icon, title, description, to, href }) => {
  const { classes, theme } = useStyles();
  const Icon = icon;
  const linkProps = href
    ? { component: 'a', href, target: '_blank', rel: 'noreferrer' }
    : { component: Link, to };
  const Chevron = theme.direction === 'rtl' ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;

  return (
    <ButtonBase className={classes.root} {...linkProps}>
      <span className={classes.icon}>{Icon && <Icon />}</span>
      <span className={classes.text}>
        <Typography variant="subtitle1" className={classes.title} noWrap>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="textSecondary">
            {description}
          </Typography>
        )}
      </span>
      {href ? (
        <OpenInNewRoundedIcon fontSize="small" className={classes.chevron} />
      ) : (
        <Chevron className={classes.chevron} />
      )}
    </ButtonBase>
  );
};

export default SettingsCard;
