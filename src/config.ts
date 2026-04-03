import { z } from "zod";

const EnvSchema = z.object({
  GOOGLE_OAUTH_CREDENTIALS_PATH: z.string().min(1).optional(),
  GOOGLE_OAUTH_TOKEN_PATH: z.string().min(1).optional(),
  GOOGLE_CALENDAR_ID: z.string().min(1).optional(),
  DEFAULT_TIMEZONE: z.string().min(1).optional(),
  DEFAULT_TRAVEL_BUFFER_MINUTES: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional()
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function getEnv(): AppEnv {
  return EnvSchema.parse(process.env);
}

export function getTokenPath(env = getEnv()): string {
  return env.GOOGLE_OAUTH_TOKEN_PATH ?? ".data/google-token.json";
}

export function getCredentialsPath(env = getEnv()): string | undefined {
  return env.GOOGLE_OAUTH_CREDENTIALS_PATH;
}

export function getDefaultTimezone(env = getEnv()): string {
  return env.DEFAULT_TIMEZONE ?? "Asia/Tokyo";
}

export function getDefaultCalendarId(env = getEnv()): string {
  return env.GOOGLE_CALENDAR_ID ?? "primary";
}

export function getDefaultTravelBufferMinutes(env = getEnv()): number {
  const raw = env.DEFAULT_TRAVEL_BUFFER_MINUTES ?? "15";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 15;
}
