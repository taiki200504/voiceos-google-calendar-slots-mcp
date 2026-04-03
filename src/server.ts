import { z } from "zod";
import { formatISO } from "date-fns";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDefaultCalendarId, getDefaultTimezone } from "./config.js";
import { listCalendarEvents } from "./calendar.js";
import { suggestWeeklySlots } from "./freeSlots.js";

const InputEventSchema = z.object({
  id: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  start: z.string().min(1),
  end: z.string().min(1)
});

const SuggestSlotsParamsShape = {
  durationMinutes: z.number().int().positive(),
  maxSuggestions: z.number().int().positive().max(50).optional(),
  timezone: z.string().min(1).optional(),
  calendarId: z.string().min(1).optional(),
  workingHours: z
    .object({
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(1).max(24)
    })
    .optional()
} as const;

const SuggestSlotsSchema = z.object(SuggestSlotsParamsShape);

const SuggestSlotsFromEventsParamsShape = {
  durationMinutes: z.number().int().positive(),
  maxSuggestions: z.number().int().positive().max(50).optional(),
  timezone: z.string().min(1).optional(),
  workingHours: z
    .object({
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(1).max(24)
    })
    .optional(),
  events: z.array(InputEventSchema)
} as const;

const SuggestSlotsFromEventsSchema = z.object(SuggestSlotsFromEventsParamsShape);

function iso(d: Date) {
  return formatISO(d);
}

function parseIsoDate(value: string): Date {
  const d = new Date(value);
  if (!Number.isFinite(d.valueOf())) throw new Error(`Invalid ISO datetime: ${value}`);
  return d;
}

async function getEventsForWeekWindow(calendarId: string, now: Date) {
  // “今週算出”のため、少し広めに取得（travel bufferで前後参照するため）
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - 1);
  timeMin.setHours(0, 0, 0, 0);

  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + 8);
  timeMax.setHours(23, 59, 59, 999);

  return await listCalendarEvents({ calendarId, timeMin, timeMax });
}

async function main() {
  const server = new McpServer({
    name: "voiceos-google-calendar-slots",
    version: "0.1.0"
  });

  server.tool(
    "suggest_weekly_free_slots_from_events",
    "（推奨）既存のGoogleカレンダーMCP等で取得した events を入力として、今週の空き枠候補を計算して返します。",
    SuggestSlotsFromEventsParamsShape,
    async (args) => {
      const safe = SuggestSlotsFromEventsSchema.parse(args);
      const now = new Date();
      const timezone = safe.timezone ?? getDefaultTimezone();

      const calendarEvents = safe.events
        .map((e, idx) => {
          const start = parseIsoDate(e.start);
          const end = parseIsoDate(e.end);
          if (end <= start) throw new Error(`Event[${idx}] has end <= start`);
          return {
            id: e.id ?? `event-${idx}`,
            summary: e.summary,
            location: e.location,
            start,
            end
          };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      const result = await suggestWeeklySlots({
        durationMinutes: safe.durationMinutes,
        maxSuggestions: safe.maxSuggestions,
        timezone,
        workingHours: safe.workingHours,
        calendarEvents,
        now
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                timezone: result.timezone,
                weekStart: iso(result.weekStart),
                weekEnd: iso(result.weekEnd),
                suggestions: result.suggestions.map((s) => ({
                  start: iso(s.start),
                  end: iso(s.end),
                  score: s.score,
                  rationale: s.rationale
                }))
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.tool(
    "suggest_weekly_free_slots",
    "Googleカレンダーの今週の空き枠を、移動時間（location）と固定バッファを加味して候補日時として返します。",
    SuggestSlotsParamsShape,
    async (args) => {
      // 念のため（toolの型推論が崩れてもここで弾く）
      const safe = SuggestSlotsSchema.parse(args);
      const now = new Date();
      const calendarId = safe.calendarId ?? getDefaultCalendarId();
      const timezone = safe.timezone ?? getDefaultTimezone();

      const events = await getEventsForWeekWindow(calendarId, now);
      const result = await suggestWeeklySlots({
        durationMinutes: safe.durationMinutes,
        maxSuggestions: safe.maxSuggestions,
        timezone,
        workingHours: safe.workingHours,
        calendarEvents: events,
        now
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                timezone: result.timezone,
                weekStart: iso(result.weekStart),
                weekEnd: iso(result.weekEnd),
                suggestions: result.suggestions.map((s) => ({
                  start: iso(s.start),
                  end: iso(s.end),
                  score: s.score,
                  rationale: s.rationale
                }))
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

