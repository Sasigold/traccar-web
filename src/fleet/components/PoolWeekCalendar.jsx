import { useState } from 'react';
import dayjs from 'dayjs';
import {
  Box,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';
import { bookingsOnDay, weekDays } from '../poolWeek';

// OPS-06: the pool's week at a glance: a row per pool vehicle, a column per day, and the
// bookings in each cell. Clicking a booking opens the same actions as the list.
const PoolWeekCalendar = ({ vehicles, bookings, nameOf, onPick }) => {
  const t = useTranslation();
  const [start, setStart] = useState(() => dayjs().startOf('week'));
  const days = weekDays(start);
  const today = dayjs().startOf('day');
  const time = (value) => dayjs(value).format('HH:mm');

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Tooltip title={t('poolWeekPrevious')}>
          <IconButton
            size="small"
            aria-label={t('poolWeekPrevious')}
            onClick={() => setStart(start.subtract(7, 'day'))}
          >
            {/* Earlier is on the right in Hebrew: the icon follows the reading direction. */}
            <ChevronRightRoundedIcon
              sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') }}
            />
          </IconButton>
        </Tooltip>
        <Typography variant="subtitle2" component="h2" aria-live="polite">
          {formatTime(days[0], 'date')} – {formatTime(days[6], 'date')}
        </Typography>
        <Tooltip title={t('poolWeekNext')}>
          <IconButton
            size="small"
            aria-label={t('poolWeekNext')}
            onClick={() => setStart(start.add(7, 'day'))}
          >
            <ChevronLeftRoundedIcon
              sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') }}
            />
          </IconButton>
        </Tooltip>
      </Stack>
      <TableContainer
        sx={{
          border: 1,
          borderColor: 'surface.border',
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Table
          size="small"
          aria-label={t('poolCalendar')}
          sx={{ tableLayout: 'fixed', minWidth: 720 }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 110 }}>{t('sharedDevice')}</TableCell>
              {days.map((day) => (
                <TableCell
                  key={day.valueOf()}
                  aria-current={day.isSame(today) ? 'date' : undefined}
                  sx={{
                    bgcolor: day.isSame(today) ? 'surface.tint' : undefined,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatTime(day, 'weekday')}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell component="th" scope="row" sx={{ whiteSpace: 'nowrap' }}>
                  <span dir="ltr">{vehicle.plate_number}</span>
                </TableCell>
                {days.map((day) => (
                  <TableCell
                    key={day.valueOf()}
                    sx={{
                      verticalAlign: 'top',
                      px: 0.75,
                      bgcolor: day.isSame(today) ? 'surface.tint' : undefined,
                    }}
                  >
                    <Stack spacing={0.5}>
                      {bookingsOnDay(bookings, vehicle.id, day).map((booking) => (
                        <Box
                          key={booking.id}
                          component="button"
                          type="button"
                          onClick={() => onPick(booking)}
                          aria-label={`${vehicle.plate_number}: ${nameOf(booking.requested_by)}, ${time(booking.starts_at)}–${time(booking.ends_at)}, ${t(`poolStatus${booking.status[0].toUpperCase()}${booking.status.slice(1)}`)}`}
                          sx={(theme) => ({
                            font: 'inherit',
                            fontSize: theme.typography.caption.fontSize,
                            textAlign: 'start',
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: 1,
                            borderColor:
                              booking.status === 'requested'
                                ? theme.palette.warning.main
                                : theme.palette.surface.borderStrong,
                            borderStyle: booking.status === 'requested' ? 'dashed' : 'solid',
                            borderRadius: 1,
                            px: 0.5,
                            py: 0.25,
                            color: theme.palette.text.primary,
                            bgcolor:
                              booking.status === 'returned'
                                ? 'transparent'
                                : theme.palette.surface.sunken,
                            opacity: booking.status === 'returned' ? 0.7 : 1,
                            '&:focus-visible': {
                              outline: `2px solid ${theme.palette.primary.main}`,
                              outlineOffset: 1,
                            },
                          })}
                        >
                          <Box component="span" dir="ltr" sx={{ display: 'block' }}>
                            {time(booking.starts_at)}–{time(booking.ends_at)}
                          </Box>
                          <Box
                            component="span"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {nameOf(booking.requested_by)}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PoolWeekCalendar;
