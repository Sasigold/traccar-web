import { memo, useRef, useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import VerticalAlignBottomRoundedIcon from '@mui/icons-material/VerticalAlignBottomRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import exportExcel from '../../common/util/exportExcel';
import { useDashboardData } from '../data/DashboardDataContext';
import { DATASETS, measureOf } from '../data/datasets';
import { periodLabel } from '../components/periodLabel';
import { HEIGHT_PRESETS, WIDTH_PRESETS } from '../layout/model';
import { presetOf } from './catalog';
import ChartWidget, { resolveChart } from './ChartWidget';
import { VizIcon } from './icons';
import WidgetFrame, { WidgetState } from './WidgetFrame';
import ErrorBoundary from '../../ErrorBoundary';
import KpiGroupWidget from './special/KpiGroupWidget';
import HeroWidget from './special/HeroWidget';
import LiveMapWidget from './special/LiveMapWidget';
import AttentionWidget from './special/AttentionWidget';
import {
  EventFeedWidget,
  ExpiriesWidget,
  MaintenanceWidget,
  TopVehiclesWidget,
} from './special/ListWidgets';

const useStyles = makeStyles()((theme) => ({
  section: {
    padding: theme.spacing(1, 2, 0.5),
    ...theme.typography.sectionLabel,
    color: theme.palette.text.secondary,
  },
  sizes: {
    padding: theme.spacing(0.5, 2, 1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  toggle: {
    '& .MuiToggleButton-root': {
      minWidth: 38,
      paddingInline: theme.spacing(1),
      fontVariantNumeric: 'tabular-nums',
    },
  },
}));

const FRACTIONS = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 9: '¾', 12: '1' };

export const widgetTitle = (config, t) =>
  config.title || t(presetOf(config.preset)?.titleKey ?? 'dashboardWCustom');

// The content of a widget by kind. Also used by the focus view and the settings preview.
export const WidgetBody = ({ config, width, height, size, table, onSelect, exportRef, title }) => {
  const preset = presetOf(config.preset);
  switch (preset?.kind) {
    case 'kpis':
      return (
        <KpiGroupWidget
          metrics={config.metrics ?? preset.metrics}
          compare={preset.compare ?? true}
          width={width}
          height={height}
        />
      );
    case 'hero':
      return (
        <HeroWidget query={{ ...preset.query, ...config.query }} width={width} height={height} />
      );
    case 'map':
      return <LiveMapWidget />;
    case 'attention':
      return <AttentionWidget width={width} height={height} table={table} />;
    case 'feed':
      return <EventFeedWidget height={height} />;
    case 'table':
      return <TopVehiclesWidget width={width} />;
    case 'expiries':
      return <ExpiriesWidget width={width} height={height} size={size} table={table} />;
    case 'maintenance':
      return <MaintenanceWidget height={height} table={table} />;
    case 'chart':
      return (
        <ChartWidget
          config={config}
          preset={preset}
          width={width}
          height={height}
          size={size}
          table={table}
          onSelect={onSelect}
          exportRef={exportRef}
          title={title}
        />
      );
    default:
      return null;
  }
};

// Caption under a widget title: what period (or "live") and which vehicles it covers.
export const useWidgetCaption = (config) => {
  const t = useTranslation();
  const { filters, range } = useDashboardData();
  const preset = presetOf(config.preset);
  if (!preset) {
    return null;
  }
  if (['expiries', 'maintenance'].includes(preset.kind)) {
    return t('dashboardCurrent');
  }
  if (['map', 'feed', 'hero'].includes(preset.kind)) {
    return t('dashboardLive');
  }
  let datasets = [preset.query?.ds];
  if (preset.kind === 'chart') {
    datasets = [resolveChart(config, preset).query.ds];
    if ((config.query?.w ?? preset.query?.w) === 'months6') {
      return t('dashboardLastSixMonths');
    }
  } else if (preset.kind === 'kpis') {
    datasets = (config.metrics ?? preset.metrics).map((metric) => metric.split('.')[0]);
  } else if (preset.kind === 'table') {
    datasets = ['summary'];
  }
  const periodic = datasets.some((ds) => DATASETS[ds]?.report || DATASETS[ds]?.time);
  if (periodic) {
    return periodLabel(filters, range, t);
  }
  return datasets.every((ds) => ds === 'live') ? t('dashboardLive') : t('dashboardCurrent');
};

const WidgetHost = ({ id, config, editing, highlight, dragging, api }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const [table, setTable] = useState(false);
  const [vizAnchor, setVizAnchor] = useState(null);
  const exportRef = useRef(null);
  const preset = presetOf(config.preset);
  const caption = useWidgetCaption(config);
  if (!preset) {
    return null;
  }
  const title = widgetTitle(config, t);
  const chart = preset.kind === 'chart' ? resolveChart(config, preset) : null;
  const tableable =
    preset.kind === 'chart' || preset.kind === 'expiries' || preset.kind === 'maintenance';
  const live = chart ? chart.query.ds === 'live' : false;

  const exportData = async () => {
    const data = exportRef.current?.();
    if (data?.rows.length) {
      const rows = data.rows.map((row) =>
        Object.fromEntries(data.columns.map((column) => [column.label, row.cells[column.key]])),
      );
      await exportExcel(
        title,
        `${title.replace(/[\\/:*?"<>|]+/g, ' ')}.xlsx`,
        new Map([[title.slice(0, 30), rows]]),
        theme,
      );
    }
  };

  const menu = [
    {
      key: 'settings',
      label: t('dashboardWidgetSettings'),
      icon: <TuneRoundedIcon fontSize="small" />,
      onClick: () => api.onSettings(id),
    },
  ];
  if (chart) {
    menu.push({
      key: 'export',
      label: t('reportExport'),
      icon: <FileDownloadRoundedIcon fontSize="small" />,
      onClick: exportData,
    });
  }
  if (editing) {
    menu.push(
      { key: 'd1', divider: true },
      {
        key: 'size',
        render: () => (
          <div key="size">
            <div className={classes.section}>{t('dashboardSize')}</div>
            <div className={classes.sizes}>
              <ToggleButtonGroup
                className={classes.toggle}
                size="small"
                exclusive
                value={api.widthOf(id)}
                onChange={(_, value) => value && api.onWidth(id, value)}
                aria-label={t('dashboardWidth')}
              >
                {WIDTH_PRESETS.map((value) => (
                  <ToggleButton
                    key={value}
                    value={value}
                    aria-label={`${t('dashboardWidth')} ${FRACTIONS[value]}`}
                  >
                    {FRACTIONS[value]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <ToggleButtonGroup
                className={classes.toggle}
                size="small"
                exclusive
                value={api.heightPresetOf(id)}
                onChange={(_, value) => value && api.onHeight(id, HEIGHT_PRESETS[value])}
                aria-label={t('dashboardHeight')}
              >
                {Object.keys(HEIGHT_PRESETS).map((key) => (
                  <ToggleButton
                    key={key}
                    value={key}
                    aria-label={`${t('dashboardHeight')} ${key.toUpperCase()}`}
                  >
                    {key.toUpperCase()}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </div>
          </div>
        ),
      },
      { key: 'd2', divider: true },
      {
        key: 'up',
        label: t('dashboardMoveEarlier'),
        icon: <KeyboardArrowUpRoundedIcon fontSize="small" />,
        onClick: () => api.onMoveBy(id, -1),
      },
      {
        key: 'down',
        label: t('dashboardMoveLater'),
        icon: <KeyboardArrowDownRoundedIcon fontSize="small" />,
        onClick: () => api.onMoveBy(id, 1),
      },
      {
        key: 'row',
        label: t('dashboardOwnRow'),
        icon: <VerticalAlignBottomRoundedIcon fontSize="small" />,
        onClick: () => api.onOwnRow(id),
      },
    );
    if (!preset.singleton) {
      menu.push({
        key: 'copy',
        label: t('dashboardDuplicate'),
        icon: <ContentCopyRoundedIcon fontSize="small" />,
        onClick: () => api.onDuplicate(id),
      });
    }
    menu.push(
      { key: 'd3', divider: true },
      {
        key: 'remove',
        label: t('sharedRemove'),
        icon: <DeleteOutlineRoundedIcon fontSize="small" />,
        onClick: () => api.onRemove(id),
      },
    );
  }

  const quick = chart && chart.allowed.length > 1 && (
    <>
      <Tooltip title={t('dashboardChangeForm')}>
        <IconButton
          size="small"
          aria-label={t('dashboardChangeForm')}
          aria-haspopup="menu"
          onClick={(event) => setVizAnchor(event.currentTarget)}
          sx={{ color: 'text.secondary' }}
        >
          <VizIcon viz={chart.viz} fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={vizAnchor} open={Boolean(vizAnchor)} onClose={() => setVizAnchor(null)}>
        <Typography component="div" className={classes.section}>
          {t('dashboardForm')}
        </Typography>
        {chart.allowed.map((viz) => (
          <MenuItem
            key={viz}
            selected={viz === chart.viz}
            onClick={() => {
              setVizAnchor(null);
              setTable(false);
              api.onViz(id, viz);
            }}
          >
            <ListItemIcon>
              <VizIcon viz={viz} fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t(`dashboardViz${viz[0].toUpperCase()}${viz.slice(1)}`)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );

  const onSelect =
    chart && api.onSelectItem && (live || chart.query.d === 'vehicle')
      ? (item, query) => api.onSelectItem(id, item, query)
      : undefined;

  return (
    <WidgetFrame
      id={id}
      title={title}
      caption={caption}
      editing={editing}
      dragging={dragging}
      highlight={highlight}
      bare={preset.kind === 'hero'}
      flush={preset.kind === 'map'}
      table={table}
      onTable={tableable ? () => setTable((value) => !value) : null}
      onFocusView={preset.kind !== 'map' ? () => api.onFocusView(id) : null}
      onDragHandle={editing && api.canDrag ? (event) => api.onDragStart(id, event) : null}
      menu={menu}
      quick={quick}
    >
      {(size) => (
        // One widget failing leaves the rest of the dashboard working.
        <ErrorBoundary
          resetKey={JSON.stringify(config)}
          fallback={(_, reset) => <WidgetState state="error" onRetry={reset} />}
        >
          <WidgetBody
            config={config}
            {...size}
            table={table}
            onSelect={onSelect}
            exportRef={exportRef}
            title={title}
          />
        </ErrorBoundary>
      )}
    </WidgetFrame>
  );
};

export const measureLabelOf = (config, t) => {
  const preset = presetOf(config.preset);
  if (preset?.kind !== 'chart') {
    return '';
  }
  const { query } = resolveChart(config, preset);
  return t(measureOf(query.ds, query.m).labelKey);
};

export default memo(WidgetHost);
