import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useAsyncTask } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PositionValue from '../common/components/PositionValue';
import PageHeader from '../common/components/shell/PageHeader';
import DataTable from '../common/components/table/DataTable';
import TableShimmer from '../common/components/TableShimmer';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
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
  table: {
    maxWidth: 960,
    width: '100%',
    marginInline: 'auto',
    flex: 'none',
  },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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

  const deviceName = useSelector((state) => {
    if (item) {
      const device = state.devices.items[item.deviceId];
      if (device) {
        return device.name;
      }
    }
    return null;
  });

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
      </div>
    </div>
  );
};

export default PositionPage;
