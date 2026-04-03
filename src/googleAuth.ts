import fs from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { getCredentialsPath, getTokenPath } from "./config.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"] as const;

type CredentialsFile = {
  installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
  web?: { client_id: string; client_secret: string; redirect_uris: string[] };
};

async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadOAuthClient(): Promise<import("google-auth-library").OAuth2Client> {
  const credentialsPath = getCredentialsPath();
  if (!credentialsPath) {
    throw new Error(
      "GOOGLE_OAUTH_CREDENTIALS_PATH is not set. Point it to your Google OAuth credentials.json."
    );
  }

  const raw = await fs.readFile(credentialsPath, "utf8");
  const creds = JSON.parse(raw) as CredentialsFile;
  const block = creds.installed ?? creds.web;
  if (!block) {
    throw new Error("Invalid credentials.json: expected 'installed' or 'web' block.");
  }

  const { client_id, client_secret, redirect_uris } = block;
  const redirectUri = redirect_uris?.[0];
  if (!redirectUri) {
    throw new Error("Invalid credentials.json: missing redirect_uris[0].");
  }

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
  const tokenPath = getTokenPath();

  try {
    const tokenRaw = await fs.readFile(tokenPath, "utf8");
    oAuth2Client.setCredentials(JSON.parse(tokenRaw));
  } catch {
    // no token yet
  }

  return oAuth2Client;
}

export function getAuthUrl(oAuth2Client: import("google-auth-library").OAuth2Client): string {
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [...SCOPES],
    prompt: "consent"
  });
}

export async function exchangeCodeAndStoreToken(
  oAuth2Client: import("google-auth-library").OAuth2Client,
  code: string
): Promise<void> {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  const tokenPath = getTokenPath();
  await ensureDirForFile(tokenPath);
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), { encoding: "utf8", mode: 0o600 });
}

