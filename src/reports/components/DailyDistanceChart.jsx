import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAttributePreference } from '../../common/util/preferences';
import { formatDistance } from '../../common/util/formatter';
import ColumnChart from '../../dashboard/charts/ColumnChart';
import useReportStyles from '../common/useReportStyles';

const HEIGHT = 160;

// REP-14: the distance of every chosen vehicle, day by day, above the summary's table.
const DailyDistanceChart = ({ points }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.floor(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const format = (value) => formatDistance(value, distanceUnit, t);
  const total = points.reduce((sum, point) => sum + point.value, 0);

  return (
    <figure
      className={classes.dailyChart}
      aria-label={`${t('reportDistancePerDay')}: ${format(total)}`}
    >
      <figcaption>{t('reportDistancePerDay')}</figcaption>
      <div ref={ref} style={{ height: HEIGHT }}>
        {width > 0 && (
          <ColumnChart
            size="md"
            width={width}
            height={HEIGHT}
            view={{ kind: 'timeseries', points, format }}
            currentLabel={t('reportCurrentPeriod')}
            previousLabel={t('reportPreviousPeriod')}
          />
        )}
      </div>
    </figure>
  );
};

export default DailyDistanceChart;
