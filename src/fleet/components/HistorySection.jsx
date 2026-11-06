import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { describeChanges } from '../../common/fleet/history';
import FormSection from '../../settings/components/FormSection';

const useStyles = makeStyles()((theme) => ({
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  changes: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    overflowWrap: 'anywhere',
  },
}));

const config = {
  vehicle: { table: 'vehicles', idColumn: 'traccar_device_id', fk: 'vehicle_id' },
  driver: { table: 'drivers', idColumn: 'traccar_driver_id', fk: 'driver_id' },
};

const camel = (value) => value.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());

// Roadmap 4.3: who changed what on this vehicle / driver and its related rows (audit log).
const HistorySection = ({ entity, traccarId }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const canRead = useFleetPermission('audit.read');
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});

  useAsyncTask(async () => {
    if (!canRead || !traccarId) {
      return;
    }
    const { table, idColumn, fk } = config[entity];
    const client = getFleetClient();
    const record = unwrap(
      await client.from(table).select('id').eq(idColumn, traccarId).maybeSingle(),
    );
    if (!record) {
      setRows([]);
      return;
    }
    const id = record.id;
    const entries = unwrap(
      await client
        .from('audit_log')
        .select('*')
        .or(
          `and(table_name.eq.${table},row_id.eq.${id}),new_data->>${fk}.eq.${id},old_data->>${fk}.eq.${id}`,
        )
        .order('created_at', { ascending: false })
        .limit(50),
    );
    setRows(entries || []);
    const userIds = [...new Set((entries || []).map((entry) => entry.user_id).filter(Boolean))];
    if (userIds.length) {
      const people = unwrap(
        await client.from('profiles').select('id, full_name, email').in('id', userIds),
      );
      setNames(
        Object.fromEntries(
          (people || []).map((person) => [person.id, person.full_name || person.email]),
        ),
      );
    }
  }, [canRead, entity, traccarId]);

  if (!canRead || !traccarId) {
    return null;
  }

  return (
    <FormSection
      title={t('fleetHistoryTitle')}
      description={t('fleetHistoryDescription')}
      icon={<HistoryRoundedIcon />}
    >
      {rows && rows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {t('fleetHistoryEmpty')}
        </Typography>
      )}
      {rows && rows.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('fleetOutboxCreated')}</TableCell>
              <TableCell>{t('fleetHistoryWho')}</TableCell>
              <TableCell>{t('fleetHistoryWhat')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={classes.nowrap}>
                  {formatTime(row.created_at, 'minutes')}
                </TableCell>
                <TableCell className={classes.nowrap}>
                  {names[row.user_id] || t('fleetHistorySystem')}
                </TableCell>
                <TableCell>
                  {`${t(`fleetHistoryAction${camel(row.action)}`)} · ${t(`fleetHistoryTable${camel(row.table_name)}`)}`}
                  {describeChanges(row).map((line) => (
                    <div key={line} className={classes.changes} dir="auto">
                      {line}
                    </div>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </FormSection>
  );
};

export default HistorySection;
