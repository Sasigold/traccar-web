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
import { HEATMAP_KINDS } from './common/heatmapPoints';
import loadHeatPoints from './common/heatmapLoad';
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
      setLoading(true);
      try {
        setPoints(await loadHeatPoints({ kind, deviceIds, groupIds, from, to, signal }));
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
            <ReportFilter autoRun={false} onShow={onShow} deviceType="multiple" loading={loading}>
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
