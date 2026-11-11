import { useRef, useState } from 'react';
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
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import {
  WidgetBody,
  exportWidget,
  selectHandler,
  widgetTitle,
  useWidgetCaption,
} from '../widgets/WidgetHost';
import { resolveChart } from '../widgets/ChartWidget';
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

// A widget enlarged to most of the screen, with its table one click away. REP-22: it exports
// like the widget, a click on a vehicle opens its details, and arrows (or the arrow keys) move
// to the previous or next widget of the dashboard.
const FocusDialog = ({ id, config, order = [], onMove, onSelectItem, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [table, setTable] = useState(false);
  const [ref, size] = useElementSize();
  const caption = useWidgetCaption(config ?? { preset: 'custom' });
  const preset = presetOf(config?.preset);
  const tableable = ['chart', 'expiries', 'maintenance', 'attention'].includes(preset?.kind);
  const exportRef = useRef(null);
  const chart = config && preset?.kind === 'chart' ? resolveChart(config, preset) : null;
  const onSelect = selectHandler(chart, onSelectItem, id);
  const index = order.indexOf(id);
  const previous = index > 0 ? order[index - 1] : null;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : null;
  const move = (target) => {
    if (target && onMove) {
      setTable(false);
      onMove(target);
    }
  };
  // In RTL the "previous" arrow points right, like reading order.
  const rtl = theme.direction === 'rtl';
  const PreviousIcon = rtl ? ChevronRightRoundedIcon : ChevronLeftRoundedIcon;
  const NextIcon = rtl ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;
  const handleKeyDown = (event) => {
    if (event.target.closest?.('input, textarea, [role="menu"]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const forward = (event.key === 'ArrowLeft') === rtl;
      move(forward ? next : previous);
    }
  };
  return (
    <Dialog
      open={Boolean(config)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={fullScreen}
      onKeyDown={handleKeyDown}
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
            {chart && (
              <IconButton
                aria-label={t('reportExport')}
                onClick={() => exportWidget(exportRef, widgetTitle(config, t), theme)}
              >
                <FileDownloadRoundedIcon />
              </IconButton>
            )}
            {order.length > 1 && (
              <>
                <IconButton
                  aria-label={t('dashboardPreviousWidget')}
                  disabled={!previous}
                  onClick={() => move(previous)}
                >
                  <PreviousIcon />
                </IconButton>
                <IconButton
                  aria-label={t('dashboardNextWidget')}
                  disabled={!next}
                  onClick={() => move(next)}
                >
                  <NextIcon />
                </IconButton>
              </>
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
                  onSelect={onSelect}
                  exportRef={exportRef}
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
