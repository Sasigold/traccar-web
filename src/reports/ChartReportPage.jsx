import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ReportFilter from './components/ReportFilter';
import ResizeHandle from './components/ResizeHandle';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapCamera from '../map/MapCamera';
import MapPositionMarkers from '../map/MapPositionMarkers';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import { formatTime } from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import { useCatch, useCatchCallback } from '../reactHelper';
import useAttributeUnits from '../common/util/useAttributeUnits';
import { attributeUnitString, formatAttributeNumber } from '../common/util/attributeUnits';
import { speedToKnots } from '../common/util/converter';
import useReportStyles from './common/useReportStyles';
import { privatePositions } from '../common/fleet/privacyData';
import PrivacyNote from '../common/components/PrivacyNote';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { niceAxis, seriesRows, spansDays } from './common/chartSeries';
import exportExcel from '../common/util/exportExcel';
import BrandLoader from '../common/components/brand/BrandLoader';

const ChartReportPage = () => {
  const { classes, cx } = useReportStyles();
  const theme = useTheme();
  const t = useTranslation();

  const positionAttributes = usePositionAttributes(t);

  const units = useAttributeUnits();

  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(0);
  const [positions, setPositions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [types, setTypes] = useState(['speed']);
  const [selectedTypes, setSelectedTypes] = useState(['speed']);
  const [timeType, setTimeType] = useState('fixTime');
  const [loading, setLoading] = useState(false);

  const selectedChartItem = items.find((item) => item.id === selectedItem?.id);

  const onMapPointClick = useCallback(
    (positionId) => setSelectedItem(positions.find((position) => position.id === positionId)),
    [positions],
  );

  // A click on a chart selects the position under the cursor (the rows are thinned, so by id).
  const onChartClick = (state) => {
    const id = state?.activePayload?.[0]?.payload?.id;
    const position = id != null && positions.find((item) => item.id === id);
    if (position) {
      setSelectedItem((previous) => (previous?.id === position.id ? null : position));
    }
  };

  // REP-15: one chart per value, each with its own unit and round axis from zero.
  const charts = useMemo(
    () =>
      selectedTypes.map((key) => {
        const rows = seriesRows(items, timeType, key);
        const definition = positionAttributes[key] || {};
        return {
          key,
          rows,
          name: definition.name || key,
          unit: attributeUnitString(definition.dataType, units, t) || '',
          axis: niceAxis(rows.map((row) => row[key]).filter((value) => value != null)),
        };
      }),
    [items, selectedTypes, timeType, positionAttributes, units, t],
  );
  const multiDay = spansDays(items, timeType);
  const formatTick = (value) => formatTime(value, multiDay ? 'minutes' : 'clock');

  const onExport = useCatch(async () => {
    const rows = items.map((item) => {
      const row = { [t('positionFixTime')]: formatTime(item[timeType], 'seconds') };
      charts.forEach((chart) => {
        const header = chart.unit ? `${chart.name} (${chart.unit})` : chart.name;
        row[header] = item[chart.key] != null ? Number(item[chart.key]) : null;
      });
      return row;
    });
    await exportExcel(t('reportChart'), 'chart.xlsx', new Map([[t('reportChart'), rows]]), theme);
  });

  const onShow = useCatchCallback(
    async ({ deviceIds, from, to }) => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ from, to });
        deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
        const response = await fetchOrThrow(`api/reports/route?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const { positions, hidden: hiddenCount } = await privatePositions(await response.json(), {
          deviceIds,
          from,
          to,
          view: 'report',
        });
        setHidden(hiddenCount);
        const keySet = new Set();
        const keyList = [];
        const formattedPositions = positions.map((position) => {
          const data = { ...position, ...position.attributes };
          const formatted = { id: position.id };
          formatted.fixTime = dayjs(position.fixTime).valueOf();
          formatted.deviceTime = dayjs(position.deviceTime).valueOf();
          formatted.serverTime = dayjs(position.serverTime).valueOf();
          Object.keys(data)
            .filter((key) => !['id', 'deviceId'].includes(key))
            .forEach((key) => {
              const value = data[key];
              if (typeof value === 'number') {
                keySet.add(key);
                const definition = positionAttributes[key] || {};
                const rawValue = key === 'obdSpeed' ? speedToKnots(value, 'kmh') : value;
                const converted = formatAttributeNumber(rawValue, definition.dataType, units);
                formatted[key] = definition.dataType === 'hours' ? converted.toFixed(2) : converted;
              }
            });
          return formatted;
        });
        Object.keys(positionAttributes).forEach((key) => {
          if (keySet.has(key)) {
            keyList.push(key);
            keySet.delete(key);
          }
        });
        setTypes([...keyList, ...keySet]);
        setItems(formattedPositions);
        setPositions(positions);
        setSelectedItem(null);
      } finally {
        setLoading(false);
      }
    },
    [positionAttributes, units],
  );

  const colorPalette = theme.palette.chart;

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportChart']}>
      <div className={classes.container}>
        {selectedItem && (
          <>
            <div className={classes.containerMap}>
              <MapView>
                <MapGeofence />
                <MapRoutePath positions={positions} />
                <MapRoutePoints positions={positions} onClick={onMapPointClick} />
                <MapPositionMarkers positions={[selectedItem]} titleField="fixTime" />
                <MapCamera positions={positions} />
              </MapView>
              <MapScale />
            </div>
            <ResizeHandle />
          </>
        )}
        <div className={cx(classes.container, classes.containerMain)}>
          <ReportFilter
            onShow={onShow}
            onExport={onExport}
            deviceType="single"
            loading={loading}
            formats={['xlsx']}
          >
            <div className={classes.filterItem}>
              <FormControl fullWidth>
                <InputLabel id="chart-report-page-report-chart-type-label">
                  {t('reportChartValues')}
                </InputLabel>
                <Select
                  labelId="chart-report-page-report-chart-type-label"
                  label={t('reportChartValues')}
                  value={selectedTypes}
                  onChange={(e) => setSelectedTypes(e.target.value)}
                  multiple
                  disabled={!items.length}
                >
                  {types.map((key) => (
                    <MenuItem key={key} value={key}>
                      {positionAttributes[key]?.name || key}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
            <div className={classes.filterItem}>
              <FormControl fullWidth>
                <InputLabel id="chart-report-page-report-time-type-label">
                  {t('reportTimeTypeLabel')}
                </InputLabel>
                <Select
                  labelId="chart-report-page-report-time-type-label"
                  label={t('reportTimeTypeLabel')}
                  value={timeType}
                  onChange={(e) => setTimeType(e.target.value)}
                  disabled={!items.length}
                >
                  <MenuItem value="fixTime">{t('positionFixTime')}</MenuItem>
                  <MenuItem value="deviceTime">{t('positionDeviceTime')}</MenuItem>
                  <MenuItem value="serverTime">{t('positionServerTime')}</MenuItem>
                </Select>
                <FormHelperText>{t('reportTimeTypeHelp')}</FormHelperText>
              </FormControl>
            </div>
          </ReportFilter>
          <PrivacyNote hidden={hidden} padded />
          {loading && (
            <div className={classes.chartLoading}>
              <BrandLoader size={56} label={t('sharedLoading')} />
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className={classes.chartStack}>
              {charts.map((chart, index) => (
                <section key={chart.key} className={classes.chartPanel} aria-label={chart.name}>
                  <Typography variant="subtitle2" className={classes.chartTitle}>
                    <span
                      className={classes.chartSwatch}
                      style={{ backgroundColor: colorPalette[index % colorPalette.length] }}
                    />
                    {chart.name}
                    {chart.unit && (
                      <Typography component="span" variant="caption" color="textSecondary">
                        {` (${chart.unit})`}
                      </Typography>
                    )}
                  </Typography>
                  <div className={classes.chartBody}>
                    <ResponsiveContainer>
                      <LineChart
                        data={chart.rows}
                        syncId="report-chart"
                        syncMethod="value"
                        onClick={onChartClick}
                        margin={{ top: 8, right: 24, left: 8, bottom: 4 }}
                      >
                        <XAxis
                          stroke={theme.palette.text.secondary}
                          tickLine={false}
                          axisLine={false}
                          dataKey={timeType}
                          type="number"
                          tickFormatter={formatTick}
                          domain={['dataMin', 'dataMax']}
                          scale="time"
                          hide={index < charts.length - 1}
                        />
                        <YAxis
                          width="auto"
                          stroke={theme.palette.text.secondary}
                          tickLine={false}
                          axisLine={false}
                          type="number"
                          domain={chart.axis.domain}
                          ticks={chart.axis.ticks}
                          allowDecimals={false}
                        />
                        <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                        {selectedChartItem && (
                          <ReferenceLine
                            x={selectedChartItem[timeType]}
                            stroke={theme.palette.text.primary}
                            strokeDasharray="3 3"
                          />
                        )}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            border: `1px solid ${theme.palette.surface.border}`,
                            borderRadius: 12,
                            boxShadow: theme.shadows[3],
                          }}
                          formatter={(value) => [
                            `${value}${chart.unit ? ` ${chart.unit}` : ''}`,
                            chart.name,
                          ]}
                          labelFormatter={(value) => formatTime(value, 'seconds')}
                        />
                        <Line
                          type="monotone"
                          dataKey={chart.key}
                          name={chart.name}
                          stroke={colorPalette[index % colorPalette.length]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default ChartReportPage;
