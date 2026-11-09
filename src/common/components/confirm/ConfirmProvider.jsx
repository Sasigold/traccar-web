import { createContext, use, useCallback, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslation } from '../LocalizationProvider';

const ConfirmContext = createContext(null);

// ADM-05: one confirmation for every destructive or far-reaching action.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title, message, confirmLabel, danger: true, typeToConfirm: name }))) return;
//
// The title names the item ("למחוק את הרכב 'טנדר 12'?"), the message says what follows. With
// typeToConfirm the button waits until that text is typed. Escape and the backdrop cancel.
export const ConfirmProvider = ({ children }) => {
  const t = useTranslation();
  const [request, setRequest] = useState(null);
  const [typed, setTyped] = useState('');
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setTyped('');
        setRequest(options);
      }),
    [],
  );

  const finish = (value) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setRequest(null);
  };

  const needed = request?.typeToConfirm?.trim();
  const ready = !needed || typed.trim() === needed;

  return (
    <ConfirmContext value={confirm}>
      {children}
      {request && (
        <Dialog open onClose={() => finish(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{request.title}</DialogTitle>
          {(request.message || needed) && (
            <DialogContent>
              {request.message && (
                <DialogContentText sx={{ whiteSpace: 'pre-line' }}>
                  {request.message}
                </DialogContentText>
              )}
              {needed && (
                <TextField
                  fullWidth
                  sx={{ mt: 2 }}
                  label={t('sharedTypeToConfirm').replace('{0}', needed)}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              )}
            </DialogContent>
          )}
          <DialogActions>
            <Button onClick={() => finish(false)} autoFocus>
              {request.cancelLabel || t('sharedCancel')}
            </Button>
            <Button
              variant="contained"
              color={request.danger === false ? 'primary' : 'error'}
              disabled={!ready}
              onClick={() => finish(true)}
            >
              {request.confirmLabel || t('sharedConfirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </ConfirmContext>
  );
};

// Outside a provider (tests of a single component) it falls back to the browser's confirm.
export const useConfirm = () => {
  const confirm = use(ConfirmContext);
  return useMemo(
    () =>
      confirm ||
      (async (options) =>
        window.confirm([options.title, options.message].filter(Boolean).join('\n\n'))),
    [confirm],
  );
};
