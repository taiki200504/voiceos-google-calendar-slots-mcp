import { google } from "googleapis";
import { loadOAuthClient } from "./googleAuth.js";

export type CalendarEvent = {
  id: string;
  summary?: string;
  location?: string;
  start: Date;
  end: Date;
};

export type ListEventsParams = {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  maxResults?: number;
};

function parseEventDateTime(dt?: { date?: string | null; dateTime?: string | null }): Date | null {
  if (!dt) return null;
  const raw = dt.dateTime ?? dt.date ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.valueOf()) ? d : null;
}

export async function listCalendarEvents(params: ListEventsParams): Promise<CalendarEvent[]> {
  const auth = await loadOAuthClient();
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.events.list({
    calendarId: params.calendarId,
    timeMin: params.timeMin.toISOString(),
    timeMax: params.timeMax.toISOString(),
    maxResults: params.maxResults ?? 250,
    singleEvents: true,
    orderBy: "startTime"
  });

  const items = res.data.items ?? [];
  const events: CalendarEvent[] = [];
  for (const item of items) {
    if (!item.id) continue;
    const start = parseEventDateTime(item.start);
    const end = parseEventDateTime(item.end);
    if (!start || !end) continue;
    if (end <= start) continue;
    events.push({
      id: item.id,
      summary: item.summary ?? undefined,
      location: item.location ?? undefined,
      start,
      end
    });
  }

  return events;
}

