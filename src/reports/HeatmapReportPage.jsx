import { useMemo, useState } from 'react';
import { Alert, MenuItem, TextField, Typography } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ReportFilter from './components/ReportFilter';
import useReportStyles from './common/useReportStyles';
import { useRunCallback } from '../reactHelper';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import MapScale from '../map/MapScale';
import MapHeatmap from '../map/MapHeatmap';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { privateCombined, privateRows } from '../common/fleet/privacyData';
import { HEATMAP_KINDS, eventPoints, stopPoints } from './common/heatmapPoints';
import { capitalize } from '../common/util/stringUtils';

// LIV-27: where things happen, as a density map: stops, idling, harsh driving or speeding, for
// the chosen vehicles and period. Useful for choosing a depot, finding idling spots and
// dangerous junctions. Hidden (private) time is left out, as in the other reports.
const HeatmapReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const [kind, setKind] = useState('stops');
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);

  const onShow = useRunCallback(
    async ({ deviceIds, groupIds, from, to, signal }) => {
      const query = new URLSearchParams({ from, to });
      deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
      groupIds.forEach((groupId) => query.append('groupId', groupId));
      setLoading(true);
      try {
        if (kind === 'stops' || kind === 'idle') {
          const response = await fetchOrThrow(`api/reports/stops?${query}`, {
            signal,
            headers: { Accept: 'application/json' },
          });
          const rows = await response.json();
          const { rows: shown } = await privateRows(rows, {
            deviceIds: [...deviceIds, ...rows.map((row) => row.deviceId)],
            from,
            to,
          });
          setPoints(stopPoints(shown, kind));
        } else {
          const response = await fetchOrThrow(`api/reports/combined?${query}`, { signal });
          const { items } = await privateCombined(await response.json(), { deviceIds, from, to });
          setPoints(eventPoints(items, kind));
        }
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  const coordinates = useMemo(
    () => (points || []).map((point) => [point.longitude, point.latitude]),
    [points],
  );

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportHeatmap']}>
      <div className={classes.container}>
        {points?.length > 0 && (
          <div className={classes.containerMap}>
            <MapView>
              <MapHeatmap points={points} />
            </MapView>
            <MapScale />
            <MapCamera coordinates={coordinates} />
          </div>
        )}
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter onShow={onShow} deviceType="multiple" loading={loading}>
              <TextField
                select
                size="small"
                label={t('reportHeatmapKind')}
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  setPoints(null);
                }}
                sx={{ minWidth: 180 }}
              >
                {HEATMAP_KINDS.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`reportHeatmap${capitalize(value)}`)}
                  </MenuItem>
                ))}
              </TextField>
            </ReportFilter>
          </div>
          {points && (
            <div style={{ padding: 16 }}>
              {points.length ? (
                <Typography variant="body2" color="textSecondary" role="status">
                  {t('reportHeatmapCount').replace('{0}', points.length.toLocaleString())}
                </Typography>
              ) : (
                <Alert severity="info">{t('reportHeatmapNone')}</Alert>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default HeatmapReportPage;
