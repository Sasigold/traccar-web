import { useNavigate } from 'react-router-dom';
import { ButtonBase, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';
import useFleetSnapshot from '../../../dashboard/useFleetSnapshot';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 34,
    borderRadius: theme.tokens.radius.pill,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
    paddingInline: 4,
    gap: 2,
    transition: 'border-color 160ms ease',
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
  },
  segment: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingInline: 10,
    borderRadius: theme.tokens.radius.pill,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    '& strong': {
      color: theme.palette.text.primary,
      fontWeight: 800,
      fontVariantNumeric: 'tabular-nums',
    },
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: theme.palette.surface.borderStrong,
  },
}));

// Compact live fleet readout in the top bar; opens the dashboard.
const FleetPulse = () => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { counts, total } = useFleetSnapshot();

  if (!total) return null;

  const segments = [
    { key: 'moving', label: t('dashboardStateMoving'), color: theme.palette.success.main },
    { key: 'stopped', label: t('dashboardStateStopped'), color: theme.palette.info.main },
    { key: 'offline', label: t('deviceStatusOffline'), color: theme.palette.error.main },
  ];

  return (
    <Tooltip title={t('shellDashboard')}>
      <ButtonBase className={classes.root} onClick={() => navigate('/dashboard')}>
        {segments.map((segment, index) => (
          <span key={segment.key} style={{ display: 'contents' }}>
            {index > 0 && <span className={classes.divider} />}
            <span className={classes.segment}>
              <span
                className={classes.dot}
                style={{
                  backgroundColor: segment.color,
                  boxShadow: `0 0 0 3px ${alpha(segment.color, 0.18)}`,
                }}
              />
              <strong>{counts[segment.key]}</strong>
              {segment.label}
            </span>
          </span>
        ))}
      </ButtonBase>
    </Tooltip>
  );
};

export default FleetPulse;
