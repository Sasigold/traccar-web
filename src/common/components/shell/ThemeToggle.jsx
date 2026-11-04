import { IconButton, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import useThemeMode from '../../theme/useThemeMode';
import { useTranslation } from '../LocalizationProvider';

const useStyles = makeStyles()(() => ({
  icon: {
    transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  rotated: {
    transform: 'rotate(-30deg)',
  },
}));

const ThemeToggle = () => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const { dark, forced, toggle } = useThemeMode();

  if (forced) {
    return null;
  }

  const label = dark ? t('shellSwitchLight') : t('shellSwitchDark');

  return (
    <Tooltip title={label}>
      <IconButton onClick={toggle} aria-label={label}>
        {dark ? (
          <LightModeRoundedIcon className={cx(classes.icon, classes.rotated)} />
        ) : (
          <DarkModeRoundedIcon className={classes.icon} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
