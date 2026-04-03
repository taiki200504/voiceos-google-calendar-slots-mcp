import { addMinutes, differenceInMinutes, endOfWeek, startOfWeek } from "date-fns";
import { getDefaultTimezone } from "./config.js";
import { clampInterval, mergeIntervals, subtractIntervals, type Interval } from "./intervals.js";
import { estimateTravelMinutes, getDefaultBufferMinutes } from "./travel.js";

export type CalendarEvent = {
  id: string;
  summary?: string;
  location?: string;
  start: Date;
  end: Date;
};

export type WorkingHours = {
  startHour: number; // 0-23
  endHour: number; // 0-24 (exclusive)
};

export type SuggestSlotsInput = {
  now?: Date;
  timezone?: string;
  durationMinutes: number;
  maxSuggestions?: number;
  workingHours?: WorkingHours;
  calendarEvents: CalendarEvent[];
};

export type SlotSuggestion = {
  start: Date;
  end: Date;
  score: number;
  rationale: string[];
};

function getWeekRange(now: Date): { weekStart: Date; weekEnd: Date } {
  // “今週”は月曜始まり（日本想定）
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  return { weekStart, weekEnd };
}

function dailyWorkingIntervals(range: { weekStart: Date; weekEnd: Date }, hours: WorkingHours): Interval[] {
  const out: Interval[] = [];
  const d = new Date(range.weekStart);
  d.setHours(0, 0, 0, 0);
  while (d <= range.weekEnd) {
    const start = new Date(d);
    start.setHours(hours.startHour, 0, 0, 0);
    const end = new Date(d);
    end.setHours(hours.endHour, 0, 0, 0);
    if (end > start) out.push({ start, end });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

async function buildBusyIntervalsWithTravel(events: CalendarEvent[], defaultBufferMinutes: number): Promise<Interval[]> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const busy: Interval[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];

    // before buffer (prev -> cur travel)
    let before = defaultBufferMinutes;
    if (prev) {
      const r = await estimateTravelMinutes({
        fromLocation: prev.location,
        toLocation: cur.location,
        defaultBufferMinutes
      });
      before = r.minutes;
    }

    // after buffer (cur -> next travel)
    let after = defaultBufferMinutes;
    if (next) {
      const r = await estimateTravelMinutes({
        fromLocation: cur.location,
        toLocation: next.location,
        defaultBufferMinutes
      });
      after = r.minutes;
    }

    busy.push({
      start: addMinutes(cur.start, -before),
      end: addMinutes(cur.end, after)
    });
  }

  return mergeIntervals(busy);
}

function chunkToDuration(free: Interval, durationMinutes: number): Interval[] {
  const out: Interval[] = [];
  let cursor = free.start;
  while (differenceInMinutes(free.end, cursor) >= durationMinutes) {
    const end = addMinutes(cursor, durationMinutes);
    out.push({ start: cursor, end });
    cursor = addMinutes(cursor, durationMinutes);
  }
  return out;
}

function scoreSlot(slot: Interval, now: Date): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;

  // 近い未来ほど高スコア（ただし直近すぎるのは避けたい場合は後で調整）
  const minsFromNow = differenceInMinutes(slot.start, now);
  score += Math.max(0, 7 * 24 * 60 - minsFromNow) / (24 * 60); // 週内で減衰
  rationale.push(`starts in ~${minsFromNow} minutes`);

  // 午前中をやや優遇（好みで調整可能）
  const hour = slot.start.getHours();
  if (hour >= 9 && hour <= 12) {
    score += 1;
    rationale.push("morning bonus");
  }

  return { score, rationale };
}

export async function suggestWeeklySlots(input: SuggestSlotsInput): Promise<{
  timezone: string;
  weekStart: Date;
  weekEnd: Date;
  suggestions: SlotSuggestion[];
}> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? getDefaultTimezone();
  const durationMinutes = Math.max(1, Math.floor(input.durationMinutes));
  const maxSuggestions = Math.max(1, Math.min(50, Math.floor(input.maxSuggestions ?? 10)));
  const workingHours: WorkingHours = input.workingHours ?? { startHour: 9, endHour: 18 };

  const { weekStart, weekEnd } = getWeekRange(now);

  // Base: working hours within this week
  const baseWorking = dailyWorkingIntervals({ weekStart, weekEnd }, workingHours);

  // Busy: events (expanded by travel buffers)
  const defaultBuffer = getDefaultBufferMinutes();
  const busyRaw = await buildBusyIntervalsWithTravel(input.calendarEvents, defaultBuffer);

  // Clamp busy to week range (plus small margin)
  const busyClamped = busyRaw
    .map((b) => clampInterval(b, weekStart, weekEnd))
    .filter((x): x is Interval => Boolean(x));

  // Free blocks
  const freeBlocks = subtractIntervals(baseWorking, busyClamped).filter((b) => b.end > b.start);

  // Candidate slots (duration-based chunking)
  const candidates: Interval[] = [];
  for (const free of freeBlocks) {
    candidates.push(...chunkToDuration(free, durationMinutes));
  }

  // Score + pick top N
  const scored = candidates
    .filter((c) => c.start >= now) // 過去を除外
    .map((c) => {
      const { score, rationale } = scoreSlot(c, now);
      return { start: c.start, end: c.end, score, rationale };
    })
    .sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime())
    .slice(0, maxSuggestions);

  return {
    timezone,
    weekStart,
    weekEnd,
    suggestions: scored
  };
}

