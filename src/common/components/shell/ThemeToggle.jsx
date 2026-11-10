import { IconButton, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import useThemeMode from '../../theme/useThemeMode';
import { useTranslation } from '../LocalizationProvider';

// BRD-03: the two icons are different elements, so a transition never ran; the new one turns
// in as it appears instead.
const turnIn = keyframes`
  from { transform: rotate(-90deg) scale(0.6); opacity: 0; }
  to { transform: none; opacity: 1; }
`;

const useStyles = makeStyles()((theme) => ({
  icon: {
    animation: `${turnIn} ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.emphasized}`,
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  },
}));

const ThemeToggle = () => {
  const { classes } = useStyles();
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
          <LightModeRoundedIcon key="light" className={classes.icon} />
        ) : (
          <DarkModeRoundedIcon key="dark" className={classes.icon} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
