import { useState } from 'react';
import { Alert, IconButton } from '@mui/material';
import ReplayIcon from '@mui/icons-material/ReplayRounded';
import { useDispatch, useSelector } from 'react-redux';
import { useAsyncTask } from './reactHelper';
import { sessionActions } from './store';
import Loader from './common/components/Loader';
import { useTranslation } from './common/components/LocalizationProvider';

const ServerProvider = ({ children }) => {
  const dispatch = useDispatch();
  const t = useTranslation();

  const initialized = useSelector((state) => !!state.session.server);
  const [error, setError] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      if (!error) {
        try {
          const response = await fetch('api/server', { signal });
          if (response.ok) {
            dispatch(sessionActions.updateServer(await response.json()));
          } else {
            const message = await response.text();
            throw Error(message || response.statusText);
          }
        } catch (error) {
          setError(error.message);
        }
      }
    },
    [error, dispatch],
  );

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <IconButton
            aria-label={t('a11yRetry')}
            color="inherit"
            size="small"
            onClick={() => setError(null)}
          >
            <ReplayIcon fontSize="inherit" />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }
  if (!initialized) {
    return <Loader />;
  }
  return children;
};

export default ServerProvider;
