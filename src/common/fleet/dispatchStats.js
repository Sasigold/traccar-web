import { isLateJob } from './dispatch';

// OPS-11: the dispatcher's exceptions board and on-time performance per customer. Pure, tested.

// Late (still open after its window) or failed: the jobs that need someone now.
export const isExceptionJob = (job, now = new Date()) =>
  job.status === 'failed' || isLateJob(job, now);

// Was a finished job on time: arrived (or completed) by the end of its window, or by its
// planned time when it has no window. Null when there is nothing to measure against.
export const onTime = (job) => {
  const due = job.window_end || job.scheduled_at;
  const at = job.arrived_at || job.completed_at;
  if (!due || !at) return null;
  return new Date(at) <= new Date(due);
};

// Per customer: done, failed, measured, on time and the on-time share (0..1, null without
// measured jobs). Customers by name (a POI's name when the job has no customer name).
export const onTimeByCustomer = (jobs) => {
  const rows = {};
  jobs.forEach((job) => {
    if (!['done', 'failed'].includes(job.status)) return;
    const name = job.customer_name || job.pois?.name || '';
    if (!name) return;
    const row = rows[name] || { customer: name, done: 0, failed: 0, measured: 0, onTime: 0 };
    if (job.status === 'failed') {
      row.failed += 1;
    } else {
      row.done += 1;
      const value = onTime(job);
      if (value != null) {
        row.measured += 1;
        if (value) row.onTime += 1;
      }
    }
    rows[name] = row;
  });
  return Object.values(rows)
    .map((row) => ({ ...row, share: row.measured ? row.onTime / row.measured : null }))
    .sort((a, b) => b.done + b.failed - (a.done + a.failed));
};
