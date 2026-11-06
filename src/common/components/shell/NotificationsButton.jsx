import { useSelector } from 'react-redux';
import { Badge, IconButton, Tooltip } from '@mui/material';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useTranslation } from '../LocalizationProvider';
import { useShell } from './ShellContext';

const NotificationsButton = () => {
  const t = useTranslation();
  const { openEvents } = useShell();
  const count = useSelector((state) => state.events.items.length + state.fleet.alertsCount);

  return (
    <Tooltip title={t('reportEvents')}>
      <IconButton onClick={openEvents} aria-label={t('reportEvents')}>
        <Badge badgeContent={count} max={99} color="error">
          <NotificationsRoundedIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default NotificationsButton;
