import {
  Snackbar,
  Alert,
  Button,
  Link,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
  useMediaQuery,
  Slide,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePrevious } from '../../reactHelper';
import { messagesActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { snackBarDurationShortMs } from '../util/duration';

const MessageHandler = () => {
  const dispatch = useDispatch();
  const t = useTranslation();

  const messages = useSelector((state) => state.messages.messages);
  const hasMessage = messages.length > 0;
  const currentMessage = messages[0];
  const cachedMessage = usePrevious(currentMessage);

  const activeMessage = hasMessage ? currentMessage : cachedMessage;
  const message =
    (typeof activeMessage === 'string' ? activeMessage : activeMessage?.message) ||
    t('errorGeneral');
  const severity = activeMessage?.severity || 'error';
  const { duration = severity === 'error' ? null : snackBarDurationShortMs } = activeMessage || {};
  const multiline = message.includes('\n');
  const displayMessage = multiline
    ? message.split('\n')[0].replace(/^(?:(?:[\w$]+\.)*[\w$]+(?:Exception|Error)?:\s*)+/i, '')
    : message;

  const [expanded, setExpanded] = useState(false);

  // LIV-09, BRD-03: messages come from the top, under the bar, on every screen (on a phone's
  // map the vehicle card and the player sit at the bottom), and slide down into place.
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const barHeight = phone ? theme.dimensions.topBarHeightMobile : theme.dimensions.topBarHeight;

  return (
    <>
      <Snackbar
        key={`${severity}:${message}`}
        open={hasMessage && !expanded}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        slots={{ transition: Slide }}
        slotProps={{ transition: { direction: 'down' } }}
        sx={{
          top: `calc(${barHeight + 8}px + env(safe-area-inset-top, 0px)) !important`,
          bottom: 'auto !important',
        }}
        autoHideDuration={duration}
        onClose={(_, reason) => {
          if (duration !== null && reason !== 'clickaway') {
            dispatch(messagesActions.pop());
          }
        }}
      >
        <Alert
          elevation={6}
          onClose={() => dispatch(messagesActions.pop())}
          severity={severity}
          variant="filled"
        >
          {displayMessage}
          {multiline && (
            <>
              {' | '}
              <Link
                color="inherit"
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setExpanded(true);
                }}
              >
                {t('sharedShowDetails')}
              </Link>
            </>
          )}
        </Alert>
      </Snackbar>
      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth={false}>
        <DialogContent>
          <DialogContentText component="div">
            <Typography component="pre" variant="caption">
              {message}
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpanded(false)} autoFocus>
            {t('sharedHide')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MessageHandler;
