import { useEffect, useState } from 'react';
import { Alert, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { formatTime } from '../../common/util/formatter';

const POLL_MS = 10000;

// ADM-26: after a new device is saved, the installer sees it come alive: "waiting for the first
// report" until a position arrives, then its time and the ignition, with a check mark.
const InstallCheck = ({ deviceId }) => {
  const t = useTranslation();
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (position) return undefined;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const response = await fetchOrThrow(`api/positions?deviceId=${deviceId}`, {
          signal: controller.signal,
        });
        const [latest] = await response.json();
        if (latest) setPosition(latest);
      } catch {
        // tried again on the next tick
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [deviceId, position]);

  if (!position) {
    return (
      <Alert severity="info" role="status">
        {t('adminInstallWaiting')}
      </Alert>
    );
  }
  const ignition = position.attributes?.ignition;
  return (
    <Alert severity="success" icon={<CheckCircleRoundedIcon />} role="status">
      <Typography variant="body2">
        {[
          t('adminInstallReported').replace('{0}', formatTime(position.fixTime, 'minutes')),
          ignition == null
            ? null
            : t(ignition ? 'adminInstallIgnitionOn' : 'adminInstallIgnitionOff'),
          position.valid === false ? t('adminInstallNoFix') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Typography>
    </Alert>
  );
};

export default InstallCheck;
