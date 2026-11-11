import fetchOrThrow from '../../common/util/fetchOrThrow';
import { delta, formatDelta, previousRange } from './compare';

// REP-09: a report's rows for the same vehicles in the period right before (same length).
export const fetchPrevious = async (endpoint, query, from, to, signal) => {
  const before = previousRange(from, to);
  const earlier = new URLSearchParams(query);
  earlier.set('from', before.from);
  earlier.set('to', before.to);
  const response = await fetchOrThrow(`api/reports/${endpoint}?${earlier.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  return response.json();
};

// The line under a tile: the figure first ("▲ 20% from the previous period"), or nothing.
export const changeHint = (t, current, earlier) => {
  const value = earlier == null ? '' : formatDelta(delta(current, earlier));
  return value ? t('reportChangeShort').replace('{0}', value) : undefined;
};
