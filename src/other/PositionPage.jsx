import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { Tab, Tabs, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import { makeStyles } from 'tss-react/mui';
import { useAsyncTask } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PositionValue from '../common/components/PositionValue';
import PageHeader from '../common/components/shell/PageHeader';
import DataTable from '../common/components/table/DataTable';
import TableShimmer from '../common/components/TableShimmer';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import TelemetryDashboard from '../common/components/telemetry/TelemetryDashboard';
import { useVehicleSettings } from '../common/components/telemetry/VehicleSettingsDialog';
import BrandLoader from '../common/components/brand/BrandLoader';
import { formatTime } from '../common/util/formatter';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  tabs: {
    maxWidth: 1200,
    width: '100%',
    marginInline: 'auto',
    paddingInline: theme.spacing(3),
    flex: 'none',
    [theme.breakpoints.down('md')]: {
      paddingInline: theme.spacing(1.5),
    },
  },
  dashboard: {
    maxWidth: 1200,
    width: '100%',
    marginInline: 'auto',
    padding: theme.spacing(2, 3, 4),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 1.5, 3),
    },
  },
  loader: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(6),
  },
  table: {
    maxWidth: 960,
    width: '100%',
    marginInline: 'auto',
    flex: 'none',
  },
  mono: {
    fontFamily: theme.tokens.font.mono,
    fontVariantNumeric: 'tabular-nums',
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
}));

const PositionPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();

  const positionAttributes = usePositionAttributes(t);

  const { id } = useParams();

  const [item, setItem] = useState();
  const [view, setView] = useState('visual');

  useAsyncTask(
    async ({ signal }) => {
      if (id) {
        const response = await fetchOrThrow(`api/positions?id=${id}`, { signal });
        const positions = await response.json();
        if (positions.length > 0) {
          setItem(positions[0]);
        }
      }
    },
    [id],
  );

  const device = useSelector((state) => (item ? state.devices.items[item.deviceId] : null));
  const deviceName = device?.name;
  const settings = useVehicleSettings(device, item);

  const rows = item
    ? [
        ...Object.getOwnPropertyNames(item)
          .filter((it) => it !== 'attributes')
          .map((property) => ({ key: property, property })),
        ...Object.getOwnPropertyNames(item.attributes).map((attribute) => ({
          key: `attr-${attribute}`,
          attribute,
        })),
      ]
    : [];

  return (
    <div className={classes.root}>
      <PageHeader
        back
        title={deviceName || t('sharedShowDetails')}
        description={item ? formatTime(item.fixTime, 'seconds') : undefined}
      />
      <div className={classes.content}>
        <Tabs value={view} onChange={(_, value) => setView(value)} className={classes.tabs}>
          <Tab
            value="visual"
            icon={<InsightsRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={t('telemetryVisual')}
          />
          <Tab
            value="table"
            icon={<TableRowsRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={t('telemetryTable')}
          />
        </Tabs>
        {view === 'visual' && (
          <div className={classes.dashboard}>
            {item ? (
              <TelemetryDashboard
                position={item}
                device={device}
                onConfigure={settings.openSettings}
                onEditParameter={settings.openParameter}
              />
            ) : (
              <div className={classes.loader}>
                <BrandLoader />
              </div>
            )}
          </div>
        )}
        {view === 'table' && (
          <DataTable className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>{t('stateName')}</TableCell>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('stateValue')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {item ? (
                rows.map(({ key, property, attribute }) => (
                  <TableRow key={key} hover>
                    <TableCell className={classes.mono}>{property || attribute}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {positionAttributes[property || attribute]?.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <PositionValue position={item} property={property} attribute={attribute} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={3} />
              )}
            </TableBody>
          </DataTable>
        )}
      </div>
      {settings.element}
    </div>
  );
};

export default PositionPage;
