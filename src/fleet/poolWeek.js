import dayjs from 'dayjs';

// OPS-06: the pool's week as a grid: a row per vehicle, a cell per day, and in each cell the
// bookings that touch that day (still requested or approved, or returned). Pure, tested.

export const SHOWN = ['requested', 'approved', 'returned'];

export const weekDays = (start, count = 7) =>
  Array.from({ length: count }, (_, index) => dayjs(start).startOf('day').add(index, 'day'));

export const bookingsOnDay = (bookings, vehicleId, day) => {
  const from = dayjs(day).startOf('day');
  const to = from.add(1, 'day');
  return bookings
    .filter(
      (booking) =>
        booking.vehicle_id === vehicleId &&
        SHOWN.includes(booking.status) &&
        dayjs(booking.starts_at).isBefore(to) &&
        dayjs(booking.ends_at).isAfter(from),
    )
    .sort((a, b) => dayjs(a.starts_at).valueOf() - dayjs(b.starts_at).valueOf());
};
