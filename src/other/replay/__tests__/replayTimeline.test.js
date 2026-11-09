import { describe, expect, it } from 'vitest';
import {
  indexAtTime,
  quickRange,
  replayStops,
  stepByTime,
  timelineSegments,
} from '../replayTimeline';

const at = (minute, speed) => ({
  fixTime: new Date(Date.UTC(2026, 10, 9, 8, minute)).toISOString(),
  speed,
});
// Drive 08:00-08:03, stand 08:03-08:10, no fix 08:10-08:30, drive 08:30-08:31.
const positions = [
  at(0, 20),
  at(1, 30),
  at(2, 25),
  at(3, 0),
  at(6, 0),
  at(10, 0),
  at(30, 15),
  at(31, 20),
];

describe('replay timeline (LIV-10)', () => {
  it('splits the route into driving, standing and gaps by time', () => {
    const segments = timelineSegments(positions);
    expect(segments.map((segment) => [segment.type, segment.fromIndex, segment.toIndex])).toEqual([
      ['moving', 0, 3],
      ['stopped', 3, 5],
      ['gap', 5, 6],
      ['moving', 6, 7],
    ]);
    expect(segments[1].end - segments[1].start).toBe(7 * 60000);
  });

  it('lists the stops of two minutes and more', () => {
    const stops = replayStops(timelineSegments(positions));
    expect(stops.map((stop) => [stop.index, stop.duration / 60000])).toEqual([
      [3, 7],
      [5, 20],
    ]);
  });

  it('finds the point at a time and steps by a minute', () => {
    const time = (minute) => Date.UTC(2026, 10, 9, 8, minute);
    expect(indexAtTime(positions, time(-5))).toBe(0);
    expect(indexAtTime(positions, time(4))).toBe(3);
    expect(indexAtTime(positions, time(20))).toBe(5);
    expect(indexAtTime(positions, time(99))).toBe(7);
    expect(stepByTime(positions, 3, 60000)).toBe(4);
    expect(stepByTime(positions, 4, 60000)).toBe(5);
    expect(stepByTime(positions, 5, -60000)).toBe(4);
    expect(stepByTime(positions, 0, -60000)).toBe(0);
    expect(stepByTime(positions, 7, 60000)).toBe(7);
  });

  it('offers today, yesterday and the last 24 hours', () => {
    const now = new Date(2026, 10, 9, 14, 30);
    expect(quickRange('today', now).from).toEqual(new Date(2026, 10, 9));
    const yesterday = quickRange('yesterday', now);
    expect(yesterday.from).toEqual(new Date(2026, 10, 8));
    expect(yesterday.to.getDate()).toBe(8);
    expect(quickRange('last24', now).from).toEqual(new Date(2026, 10, 8, 14, 30));
  });
});
