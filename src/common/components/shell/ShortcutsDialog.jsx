import {
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  kbd: {
    display: 'inline-block',
    minWidth: 24,
    padding: '0 6px',
    borderRadius: theme.tokens.radius.xs,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    fontFamily: theme.tokens.font.mono,
    fontSize: '0.75rem',
    textAlign: 'center',
  },
}));

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// LIV-15: "?" lists the keyboard shortcuts.
const ShortcutsDialog = ({ open, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const rows = [
    [isMac ? '⌘K' : 'Ctrl K', 'shortcutPalette'],
    ['/', 'shortcutPalette'],
    ['?', 'shortcutHelp'],
    ['Esc', 'shortcutEscape'],
    ['Space', 'shortcutReplayPlay'],
    ['← →', 'shortcutReplayStep'],
    ['Shift ← →', 'shortcutReplayMinute'],
  ];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('shortcutsTitle')}</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableBody>
            {rows.map(([keys, labelKey]) => (
              <TableRow key={`${keys}-${labelKey}`}>
                <TableCell dir="ltr">
                  <kbd className={classes.kbd}>{keys}</kbd>
                </TableCell>
                <TableCell>{t(labelKey)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsDialog;
