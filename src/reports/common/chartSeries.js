// REP-15: honest charts: round axes that start at zero, lines that break where data is missing,
// and at most a few thousand points per line.

const niceStep = (raw) => {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
};

// An axis from zero (or below, for values that really go negative) to a round top.
export const niceAxis = (values, tickCount = 5) => {
  const numbers = values.map(Number).filter(Number.isFinite);
  const max = numbers.length ? Math.max(...numbers) : 0;
  const min = numbers.length ? Math.min(...numbers) : 0;
  const low = Math.min(0, min);
  const high = max > low ? max : low + 1;
  const step = niceStep((high - low) / (tickCount - 1));
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return { domain: [start, end], ticks };
};

// A gap longer than this (or five typical intervals) breaks the line.
export const insertGaps = (rows, xKey, keys, minGap = 10 * 60000) => {
  if (rows.length < 3) return rows;
  const intervals = rows
    .slice(1)
    .map((row, index) => row[xKey] - rows[index][xKey])
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)] || 0;
  const limit = Math.max(minGap, median * 5);
  const result = [rows[0]];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    if (rows[index][xKey] - previous[xKey] > limit) {
      const gap = { [xKey]: previous[xKey] + 1, gap: true };
      keys.forEach((key) => {
        gap[key] = null;
      });
      result.push(gap);
    }
    result.push(rows[index]);
  }
  return result;
};

// Largest-Triangle-Three-Buckets: keeps the shape of a line with fewer points.
export const lttb = (rows, threshold, xKey, yKey) => {
  if (threshold >= rows.length || threshold < 3) return rows;
  const sampled = [rows[0]];
  const every = (rows.length - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i += 1) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, rows.length);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j += 1) {
      avgX += rows[j][xKey];
      avgY += Number(rows[j][yKey]) || 0;
    }
    const count = avgEnd - avgStart || 1;
    avgX /= count;
    avgY /= count;
    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.floor((i + 1) * every) + 1;
    const ax = rows[a][xKey];
    const ay = Number(rows[a][yKey]) || 0;
    let maxArea = -1;
    let next = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j += 1) {
      const area = Math.abs(
        (ax - avgX) * ((Number(rows[j][yKey]) || 0) - ay) - (ax - rows[j][xKey]) * (avgY - ay),
      );
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    sampled.push(rows[next]);
    a = next;
  }
  sampled.push(rows[rows.length - 1]);
  return sampled;
};

export const MAX_POINTS = 2000;

// The rows of one chart: its value as a number, thinned, with breaks at gaps.
export const seriesRows = (items, xKey, key, maxPoints = MAX_POINTS) => {
  const rows = items
    .filter((item) => item[key] != null && Number.isFinite(Number(item[key])))
    .map((item) => ({ id: item.id, [xKey]: item[xKey], [key]: Number(item[key]) }));
  return insertGaps(lttb(rows, maxPoints, xKey, key), xKey, [key]);
};

export const spansDays = (items, xKey) =>
  items.length > 1 && items[items.length - 1][xKey] - items[0][xKey] > 24 * 3600 * 1000;
