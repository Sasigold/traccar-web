import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { WidgetBody, widgetTitle, useWidgetCaption } from '../widgets/WidgetHost';
import { presetOf } from '../widgets/catalog';
import useElementSize from '../layout/useElementSize';
import { sizeClass } from '../charts/chartTheme';

const useStyles = makeStyles()((theme) => ({
  paper: {
    height: '82vh',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    display: 'block',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  body: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
  },
}));

// A widget enlarged to most of the screen, with its table one click away.
const FocusDialog = ({ config, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [table, setTable] = useState(false);
  const [ref, size] = useElementSize();
  const caption = useWidgetCaption(config ?? { preset: 'custom' });
  const preset = presetOf(config?.preset);
  const tableable = ['chart', 'expiries', 'maintenance'].includes(preset?.kind);
  return (
    <Dialog
      open={Boolean(config)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { className: fullScreen ? undefined : classes.paper } }}
    >
      {config && (
        <>
          <DialogTitle className={classes.title}>
            <span className={classes.titleText}>
              {widgetTitle(config, t)}
              <span className={classes.caption}>{caption}</span>
            </span>
            {tableable && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={table ? 'table' : 'chart'}
                onChange={(_, value) => value && setTable(value === 'table')}
              >
                <ToggleButton value="chart" aria-label={t('dashboardShowChart')}>
                  <InsightsRoundedIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="table" aria-label={t('dashboardShowTable')}>
                  <TableRowsRoundedIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            <IconButton aria-label={t('sharedHide')} onClick={onClose}>
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent className={classes.content}>
            <div ref={ref} className={classes.body}>
              {size.width > 0 && (
                <WidgetBody
                  config={config}
                  {...size}
                  size={sizeClass(size.width, size.height)}
                  table={table}
                  title={widgetTitle(config, t)}
                />
              )}
            </div>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};

export default FocusDialog;
