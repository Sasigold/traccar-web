import { useReducer, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { IconButton, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import { useAsyncTask, useCatch } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ReportIntro from './components/ReportIntro';
import TableShimmer from '../common/components/TableShimmer';
import DataTable from '../common/components/table/DataTable';
import RemoveDialog from '../common/components/RemoveDialog';
import fetchOrThrow from '../common/util/fetchOrThrow';
import ScheduleDialog from './components/ScheduleDialog';
import { describeSchedule } from './common/schedule';
import { calendarsActions } from '../store';

const useStyles = makeStyles()((theme) => ({
  columnAction: {
    width: '1%',
    paddingInlineEnd: theme.spacing(1),
    whiteSpace: 'nowrap',
  },
}));

const TYPE_KEYS = {
  events: 'reportEvents',
  route: 'reportPositions',
  summary: 'reportSummary',
  trips: 'reportTrips',
  stops: 'reportStops',
};
const TYPE_PATHS = {
  events: '/reports/events',
  route: '/reports/route',
  summary: '/reports/summary',
  trips: '/reports/trips',
  stops: '/reports/stops',
};

const decode = (calendar) => {
  try {
    return calendar?.data ? window.atob(calendar.data) : '';
  } catch {
    return '';
  }
};

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Reports emailed on a schedule (REP-08): what, how often in plain words, and open, edit or remove.
const ScheduledPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const calendars = useSelector((state) => state.calendars.items);

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [editing, setEditing] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      setLoading(true);
      try {
        const [reports, calendarList] = await Promise.all([
          fetchOrThrow('api/reports', { signal }).then((response) => response.json()),
          fetchOrThrow('api/calendars', { signal }).then((response) => response.json()),
        ]);
        dispatch(calendarsActions.refresh(calendarList));
        setItems(reports);
      } finally {
        setLoading(false);
      }
    },
    [reloadKey, dispatch],
  );

  const scheduleText = (item) => {
    const calendar = calendars[item.calendarId];
    const schedule = describeSchedule(decode(calendar));
    if (!schedule) {
      return calendar?.name || '—';
    }
    const hour = `${String(schedule.hour).padStart(2, '0')}:00`;
    return schedule.frequency === 'weekly'
      ? t('reportScheduleEveryWeek')
          .replace('{0}', t(`reportScheduleDay${schedule.weekday}`))
          .replace('{1}', hour)
      : t('reportScheduleEveryDay').replace('{0}', hour);
  };

  const saveEdit = useCatch(async ({ name, calendarData }) => {
    const { item } = editing;
    const calendar = calendars[item.calendarId];
    await fetchOrThrow(
      `api/calendars/${calendar.id}`,
      json('PUT', { ...calendar, name, data: calendarData }),
    );
    await fetchOrThrow(`api/reports/${item.id}`, json('PUT', { ...item, description: name }));
    setEditing(null);
    reload();
  });

  // A calendar made for this report goes with it, unless another report uses it too.
  const removed = useCatch(async (item) => {
    const calendar = calendars[item.calendarId];
    const ours = describeSchedule(decode(calendar));
    const shared = items.some(
      (other) => other.id !== item.id && other.calendarId === item.calendarId,
    );
    if (calendar && ours && !shared) {
      await fetchOrThrow(`api/calendars/${calendar.id}`, { method: 'DELETE' });
    }
    reload();
  });

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportScheduled']}>
      <DataTable
        variant="flush"
        toolbar={<ReportIntro padded />}
        empty={!loading && items.length === 0}
        emptyState={{
          icon: <EventRepeatRoundedIcon />,
          title: t('reportScheduledNone'),
          description: t('reportScheduledNoneHelp'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedType')}</TableCell>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('reportScheduleWhen')}</TableCell>
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading ? (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{t(TYPE_KEYS[item.type] || 'sharedType')}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{scheduleText(item)}</TableCell>
                <TableCell className={classes.columnAction} padding="none">
                  {TYPE_PATHS[item.type] && (
                    <Tooltip title={t('reportScheduleOpen')}>
                      <IconButton
                        aria-label={t('reportScheduleOpen')}
                        size="small"
                        onClick={() => navigate(TYPE_PATHS[item.type])}
                      >
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {describeSchedule(decode(calendars[item.calendarId])) && (
                    <Tooltip title={t('sharedEdit')}>
                      <IconButton
                        aria-label={t('sharedEdit')}
                        size="small"
                        onClick={() =>
                          setEditing({
                            item,
                            initial: {
                              name: item.description,
                              ...describeSchedule(decode(calendars[item.calendarId])),
                            },
                          })
                        }
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t('sharedRemove')}>
                    <IconButton
                      aria-label={t('sharedRemove')}
                      size="small"
                      onClick={() => setRemoving(item)}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableShimmer columns={4} endAction />
          )}
        </TableBody>
      </DataTable>
      {editing && (
        <ScheduleDialog
          title={t('sharedEdit')}
          initial={editing.initial}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      <RemoveDialog
        style={{ transform: 'none' }}
        open={Boolean(removing)}
        endpoint="reports"
        itemId={removing?.id}
        onResult={(done) => {
          const item = removing;
          setRemoving(null);
          if (done) {
            removed(item);
          }
        }}
      />
    </PageLayout>
  );
};

export default ScheduledPage;
