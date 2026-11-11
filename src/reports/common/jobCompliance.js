// REP-23: how dispatch jobs kept their time window, per driver. Pure, unit-tested.

// A done job is on time when it arrived (or, with no arrival, finished) by the end of its
// window; a job without a window counts as on time. Anything not done has no verdict.
/** @param {{ status: string, window_end?: string | null, arrived_at?: string | null, completed_at?: string | null }} job */
export const jobOnTime = (job) => {
  if (job.status !== 'done') return null;
  if (!job.window_end) return true;
  const at = job.arrived_at || job.completed_at;
  return at ? Date.parse(at) <= Date.parse(job.window_end) : null;
};

/**
 * Rows per driver: jobs (cancelled ones left out), done, on time, late, failed and the share on
 * time of those with a verdict. Jobs without a driver form one row of their own.
 * @param {any[]} jobs
 * @param {string} noDriver the name of that row
 */
export const jobsByDriver = (jobs, noDriver) => {
  const rows = new Map();
  (jobs || [])
    .filter((job) => job.status !== 'cancelled')
    .forEach((job) => {
      const key = job.driver_id || '';
      const row = rows.get(key) || {
        driverId: key,
        traccarDriverId: job.drivers?.traccar_driver_id ?? null,
        name: job.drivers?.full_name || noDriver,
        jobs: 0,
        done: 0,
        onTime: 0,
        late: 0,
        failed: 0,
      };
      row.jobs += 1;
      if (job.status === 'done') row.done += 1;
      if (job.status === 'failed') row.failed += 1;
      const verdict = jobOnTime(job);
      if (verdict === true) row.onTime += 1;
      if (verdict === false) row.late += 1;
      rows.set(key, row);
    });
  return [...rows.values()].map((row) => ({
    ...row,
    onTimeShare:
      row.onTime + row.late > 0 ? Math.round((row.onTime / (row.onTime + row.late)) * 100) : null,
  }));
};
