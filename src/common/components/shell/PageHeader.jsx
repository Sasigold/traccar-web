import { useEffect } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Breadcrumbs, IconButton, Link, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import BackIcon from '../BackIcon';
import { useTranslation } from '../LocalizationProvider';
import { useConfirm } from '../confirm/ConfirmProvider';
import { goBack, useLeaveGuard } from '../confirm/unsavedChanges';
import useNavItems from './navItems';

const crumbLinks = {
  settingsTitle: '/settings',
  reportTitle: '/reports',
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5, 3, 1.5),
    flexShrink: 0,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1.25, 1.5),
      gap: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.palette.surface.border}`,
      backgroundColor: theme.palette.background.paper,
    },
    '@media print': {
      padding: 0,
    },
  },
  titles: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontWeight: 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.25,
    [theme.breakpoints.down('md')]: {
      fontSize: '1.0625rem',
    },
  },
  crumbs: {
    '& .MuiBreadcrumbs-separator': {
      marginInline: theme.spacing(0.75),
    },
  },
  crumb: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
    '@media print': {
      display: 'none',
    },
  },
}));

const PageHeader = ({ breadcrumbs, title, description, actions, onOpenMenu, backTo, back }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();
  // ADM-05: unsaved changes are asked about before leaving.
  const leave = useLeaveGuard(useConfirm(), t);

  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  // LIV-09: a tab's own page has no way back; the arrow is for pages deeper in.
  const location = useLocation();
  const destination = useNavItems().some((item) => item.path === location.pathname);

  const crumbs = breadcrumbs || [];
  const resolvedTitle = title ?? (crumbs.length ? t(crumbs[crumbs.length - 1]) : '');
  // LIV-16: the browser tab says which screen this is.
  useEffect(() => {
    if (typeof resolvedTitle === 'string' && resolvedTitle) {
      document.title = `${resolvedTitle} · viper fleet`;
    }
  }, [resolvedTitle]);
  const parents = crumbs.slice(0, -1);

  return (
    <header className={`${classes.root} app-page-header`}>
      {((!desktop && !destination) || back) && (
        <IconButton
          edge="start"
          onClick={() => leave(() => (backTo != null ? navigate(backTo) : goBack(navigate)))}
          aria-label={t('a11yBack')}
        >
          <BackIcon />
        </IconButton>
      )}
      <div className={classes.titles}>
        {desktop && parents.length > 0 && (
          <Breadcrumbs className={classes.crumbs} aria-label={t('a11yBreadcrumb')}>
            {parents.map((crumb) =>
              crumbLinks[crumb] ? (
                <Link
                  key={crumb}
                  component={RouterLink}
                  to={crumbLinks[crumb]}
                  underline="hover"
                  className={classes.crumb}
                >
                  {t(crumb)}
                </Link>
              ) : (
                <Typography key={crumb} className={classes.crumb}>
                  {t(crumb)}
                </Typography>
              ),
            )}
          </Breadcrumbs>
        )}
        <Typography variant={desktop ? 'h4' : 'h6'} component="h1" className={classes.title} noWrap>
          {resolvedTitle}
        </Typography>
        {desktop && description && (
          <Typography variant="body2" color="textSecondary">
            {description}
          </Typography>
        )}
      </div>
      {actions && <div className={classes.actions}>{actions}</div>}
      {!desktop && onOpenMenu && (
        <Tooltip title={t('shellOpenMenu')}>
          <IconButton edge="end" onClick={onOpenMenu} aria-label={t('shellOpenMenu')}>
            <MenuOpenRoundedIcon />
          </IconButton>
        </Tooltip>
      )}
    </header>
  );
};

export default PageHeader;
