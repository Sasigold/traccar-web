import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useAsyncTask } from '../reactHelper';
import PageHeader from '../common/components/shell/PageHeader';
import DataTable from '../common/components/table/DataTable';
import { useTranslation } from '../common/components/LocalizationProvider';
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
    gap: theme.spacing(2),
  },
  table: {
    maxWidth: 960,
    width: '100%',
    marginInline: 'auto',
    flex: 'none',
  },
}));

const NetworkPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();

  const { positionId } = useParams();

  const [item, setItem] = useState({});

  useAsyncTask(
    async ({ signal }) => {
      if (positionId) {
        const response = await fetchOrThrow(`api/positions?id=${positionId}`, { signal });
        const positions = await response.json();
        if (positions.length > 0) {
          setItem(positions[0]);
        }
      }
    },
    [positionId],
  );

  const deviceName = useSelector((state) => {
    if (item) {
      const device = state.devices.items[item.deviceId];
      if (device) {
        return device.name;
      }
    }
    return null;
  });

  const cells = item.network?.cellTowers || [];
  const wifi = item.network?.wifiAccessPoints || [];

  return (
    <div className={classes.root}>
      <PageHeader back title={deviceName || t('positionNetwork')} />
      <div className={classes.content}>
        <DataTable
          className={classes.table}
          empty={cells.length === 0}
          emptyState={{ title: t('sharedNoData') }}
        >
          <TableHead>
            <TableRow>
              <TableCell>MCC</TableCell>
              <TableCell>MNC</TableCell>
              <TableCell>LAC</TableCell>
              <TableCell>CID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cells.map((cell) => (
              <TableRow key={cell.cellId} hover>
                <TableCell>{cell.mobileCountryCode}</TableCell>
                <TableCell>{cell.mobileNetworkCode}</TableCell>
                <TableCell>{cell.locationAreaCode}</TableCell>
                <TableCell>{cell.cellId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
        <DataTable
          className={classes.table}
          empty={wifi.length === 0}
          emptyState={{ title: t('sharedNoData') }}
        >
          <TableHead>
            <TableRow>
              <TableCell>MAC</TableCell>
              <TableCell>RSSI</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {wifi.map((point) => (
              <TableRow key={point.macAddress} hover>
                <TableCell>{point.macAddress}</TableCell>
                <TableCell>{point.signalStrength}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>
    </div>
  );
};

export default NetworkPage;
