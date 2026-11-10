import { DEFAULT_POLICY, isWorkTime } from '../../common/fleet/privacy';
import { restPeriodAt } from '../../common/util/israeliCalendar';

// REP-14: when a trip started, for the trips report: during Shabbat or a holiday ('shabbat' or
// the holiday's key in `restDay`), or outside the organization's working hours. Pure, tested.
export const tripTiming = (trip, policy = DEFAULT_POLICY, place) => {
  const time = Date.parse(trip.startTime);
  if (Number.isNaN(time)) return { restDay: null, outsideHours: false };
  const rest = restPeriodAt(time, place);
  return {
    restDay: rest ? rest.kind : null,
    outsideHours: !rest && !isWorkTime(policy || DEFAULT_POLICY, time),
  };
};
