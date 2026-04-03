export type Interval = { start: Date; end: Date };

export function clampInterval(i: Interval, min: Date, max: Date): Interval | null {
  const start = i.start < min ? min : i.start;
  const end = i.end > max ? max : i.end;
  if (end <= start) return null;
  return { start, end };
}

export function sortIntervals(intervals: Interval[]): Interval[] {
  return [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = sortIntervals(intervals);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push({ start: cur.start, end: cur.end });
      continue;
    }
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

export function subtractIntervals(freeBase: Interval[], busy: Interval[]): Interval[] {
  const busyMerged = mergeIntervals(busy);
  const baseSorted = sortIntervals(freeBase);
  const out: Interval[] = [];

  for (const base of baseSorted) {
    let cursor = base.start;
    for (const b of busyMerged) {
      if (b.end <= cursor) continue;
      if (b.start >= base.end) break;
      if (b.start > cursor) {
        out.push({ start: cursor, end: b.start < base.end ? b.start : base.end });
      }
      cursor = b.end > cursor ? b.end : cursor;
      if (cursor >= base.end) break;
    }
    if (cursor < base.end) out.push({ start: cursor, end: base.end });
  }

  return out.filter((i) => i.end > i.start);
}

