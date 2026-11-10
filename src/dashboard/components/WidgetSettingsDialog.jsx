import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { DATASETS, DIMENSIONS, measureOf, resolveQuery } from '../data/datasets';
import { presetOf } from '../widgets/catalog';
import { allowedViz, pickViz } from '../widgets/vizRules';
import { VizIcon } from '../widgets/icons';
import { WidgetBody, widgetTitle } from '../widgets/WidgetHost';
import useElementSize from '../layout/useElementSize';
import { sizeClass } from '../charts/chartTheme';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  label: {
    ...theme.typography.sectionLabel,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.75),
  },
  vizGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
    gap: theme.spacing(1),
  },
  vizButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.25, 0.5),
    borderRadius: `${theme.tokens.radius.md}px !important`,
    border: `1px solid ${theme.palette.surface.border} !important`,
    textTransform: 'none',
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    '&.Mui-selected': {
      backgroundColor: theme.palette.surface.tint,
      borderColor: `${theme.palette.primary.main} !important`,
      color: theme.palette.primary.main,
    },
    '&.Mui-selected:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
    },
  },
  row: {
    display: 'flex',
    gap: theme.spacing(1.5),
    '& > *': {
      flex: 1,
      minWidth: 0,
    },
  },
  preview: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minHeight: 0,
  },
  previewBox: {
    position: 'relative',
    height: 300,
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1.5, 2),
  },
  previewInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  previewTitle: {
    ...theme.typography.subtitle1,
    marginBottom: theme.spacing(1),
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: theme.spacing(0, 1),
  },
}));

const cap = (value) => `${value[0].toUpperCase()}${value.slice(1)}`;

const Preview = ({ config, title }) => {
  const { classes } = useStyles();
  const [ref, size] = useElementSize();
  return (
    <div className={classes.previewBox}>
      <div className={classes.previewTitle}>{title}</div>
      <div ref={ref} className={classes.previewInner} style={{ height: 'calc(100% - 32px)' }}>
        {size.width > 0 && (
          <WidgetBody
            config={config}
            {...size}
            size={sizeClass(size.width, size.height)}
            title={title}
          />
        )}
      </div>
    </div>
  );
};

// Settings of one widget: its title, what data it shows ("what", "by", "split by",
// how many) and in which form, with a live preview.
const WidgetSettingsDialog = ({ open, config, onClose, onSave }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [draft, setDraft] = useState(config);
  useEffect(() => {
    if (open) {
      setDraft(config);
    }
  }, [open, config]);

  const fleetAllowed = {
    'costs.read': useFleetPermission('costs.read'),
    'maintenance.read': useFleetPermission('maintenance.read'),
    'incidents.read': useFleetPermission('incidents.read'),
    'safety.read': useFleetPermission('safety.read'),
  };

  const preset = presetOf(draft?.preset);
  const isChart = preset?.kind === 'chart';
  const query = useMemo(
    () => (isChart ? resolveQuery({ ...preset.query, ...draft.query }) : null),
    [isChart, preset, draft],
  );
  const measure = query ? measureOf(query.ds, query.m) : null;
  const allowed = query ? allowedViz(query, measure) : [];
  const viz = query ? pickViz(draft.viz ?? preset.viz, allowed, preset.viz) : null;

  if (!draft || !preset) {
    return null;
  }

  const setQuery = (patch) => {
    setDraft((current) => {
      const nextQuery = { ...resolveQuery({ ...preset.query, ...current.query }), ...patch };
      const resolved = resolveQuery(nextQuery);
      const nextAllowed = allowedViz(resolved, measureOf(resolved.ds, resolved.m));
      return {
        ...current,
        query: { ...resolved, d: resolved.d ?? undefined, b: resolved.b ?? undefined },
        viz: pickViz(current.viz ?? preset.viz, nextAllowed, nextAllowed[0]),
      };
    });
  };

  const datasetAvailable = (key) => !DATASETS[key].fleet || fleetAllowed[DATASETS[key].fleet];
  const dataset = query ? DATASETS[query.ds] : null;
  const timeDimension = query?.d && DIMENSIONS[query.d].type === 'time';
  const categoryDimension = query?.d && !timeDimension;

  const allMetrics = Object.entries(DATASETS)
    .filter(([key]) => datasetAvailable(key))
    .flatMap(([key, item]) =>
      Object.keys(item.measures).map((measureKey) => ({
        id: `${key}.${measureKey}`,
        ds: key,
        item,
        measureKey,
      })),
    );
  const metrics = draft.metrics ?? preset.metrics ?? [];
  const title = widgetTitle(draft, t);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{t('dashboardWidgetSettings')}</DialogTitle>
      <DialogContent>
        <div className={classes.content}>
          <div className={classes.form}>
            <TextField
              label={t('dashboardWidgetTitle')}
              placeholder={t(preset.titleKey)}
              value={draft.title ?? ''}
              slotProps={{ htmlInput: { maxLength: 60 }, inputLabel: { shrink: true } }}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value || undefined }))
              }
            />
            {isChart && (
              <>
                <FormControl fullWidth>
                  <InputLabel>{t('dashboardData')}</InputLabel>
                  <Select
                    label={t('dashboardData')}
                    value={`${query.ds}.${query.m}`}
                    onChange={(event) => {
                      const [ds, m] = event.target.value.split('.');
                      const keep = DATASETS[ds].dimensions.includes(query.d)
                        ? query.d
                        : DATASETS[ds].dimensions[0];
                      setQuery({
                        ds,
                        m,
                        d: keep,
                        b: DATASETS[ds].dimensions.includes(query.b) ? query.b : null,
                      });
                    }}
                  >
                    {Object.entries(DATASETS)
                      .filter(([key]) => datasetAvailable(key))
                      .flatMap(([key, item]) => [
                        <ListSubheader key={`h-${key}`}>{t(item.labelKey)}</ListSubheader>,
                        ...Object.entries(item.measures).map(([measureKey, entry]) => (
                          <MenuItem key={`${key}.${measureKey}`} value={`${key}.${measureKey}`}>
                            {t(entry.labelKey)}
                          </MenuItem>
                        )),
                      ])}
                  </Select>
                </FormControl>
                <div className={classes.row}>
                  <FormControl fullWidth>
                    <InputLabel>{t('dashboardBy')}</InputLabel>
                    <Select
                      label={t('dashboardBy')}
                      value={query.d ?? ''}
                      onChange={(event) => setQuery({ d: event.target.value || null })}
                    >
                      <MenuItem value="">{t('dashboardSingleNumber')}</MenuItem>
                      {dataset.dimensions.map((key) => (
                        <MenuItem key={key} value={key}>
                          {t(`dashboardD${cap(key)}`)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth disabled={!query.d}>
                    <InputLabel>{t('dashboardSplitBy')}</InputLabel>
                    <Select
                      label={t('dashboardSplitBy')}
                      value={query.b ?? ''}
                      onChange={(event) => setQuery({ b: event.target.value || null })}
                    >
                      <MenuItem value="">{t('dashboardNoSplit')}</MenuItem>
                      {dataset.dimensions
                        .filter(
                          (key) =>
                            key !== query.d &&
                            DIMENSIONS[key].type !== 'time' &&
                            DIMENSIONS[key].type === 'category',
                        )
                        .map((key) => (
                          <MenuItem key={key} value={key}>
                            {t(`dashboardD${cap(key)}`)}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </div>
                {categoryDimension && (
                  <div className={classes.row}>
                    <FormControl fullWidth>
                      <InputLabel>{t('dashboardShowTop')}</InputLabel>
                      <Select
                        label={t('dashboardShowTop')}
                        value={query.n}
                        onChange={(event) => setQuery({ n: event.target.value })}
                      >
                        {[3, 5, 6, 8, 10, 15, 20].map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel>{t('dashboardSort')}</InputLabel>
                      <Select
                        label={t('dashboardSort')}
                        value={query.s}
                        onChange={(event) => setQuery({ s: event.target.value })}
                      >
                        <MenuItem value="desc">{t('dashboardSortDesc')}</MenuItem>
                        <MenuItem value="asc">{t('dashboardSortAsc')}</MenuItem>
                        <MenuItem value="natural">{t('dashboardSortNatural')}</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                )}
                <div>
                  <div className={classes.label}>{t('dashboardForm')}</div>
                  <ToggleButtonGroup
                    exclusive
                    className={classes.vizGrid}
                    value={viz}
                    onChange={(_, value) =>
                      value && setDraft((current) => ({ ...current, viz: value }))
                    }
                    aria-label={t('dashboardForm')}
                  >
                    {allowed.map((value) => (
                      <ToggleButton key={value} value={value} className={classes.vizButton}>
                        <VizIcon viz={value} />
                        {t(`dashboardViz${cap(value)}`)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              </>
            )}
            {preset.kind === 'kpis' && (
              <div>
                <div className={classes.label}>{t('dashboardMetrics')}</div>
                <div className={classes.metrics}>
                  {allMetrics.map((metric) => (
                    <FormControlLabel
                      key={metric.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={metrics.includes(metric.id)}
                          disabled={!metrics.includes(metric.id) && metrics.length >= 6}
                          onChange={(event) =>
                            setDraft((current) => {
                              const list = current.metrics ?? preset.metrics;
                              const next = event.target.checked
                                ? [...list, metric.id]
                                : list.filter((item) => item !== metric.id);
                              return { ...current, metrics: next.length ? next : list };
                            })
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {t(metric.item.measures[metric.measureKey].labelKey)}
                          <Typography component="span" variant="caption" color="text.secondary">
                            {` · ${t(metric.item.labelKey)}`}
                          </Typography>
                        </Typography>
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {isChart && dataset.report && !query.d && (
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(query.c)}
                    onChange={(event) => setQuery({ c: event.target.checked })}
                  />
                }
                label={t('dashboardCompare')}
              />
            )}
          </div>
          <div className={classes.preview}>
            <div className={classes.label}>{t('dashboardPreview')}</div>
            <Preview config={draft} title={title} />
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={() => onSave(draft)}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WidgetSettingsDialog;
