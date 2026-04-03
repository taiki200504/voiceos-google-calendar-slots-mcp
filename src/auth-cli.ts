import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { exchangeCodeAndStoreToken, getAuthUrl, loadOAuthClient } from "./googleAuth.js";

async function main() {
  const oAuth2Client = await loadOAuthClient();

  const authUrl = getAuthUrl(oAuth2Client);
  output.write(`Open this URL in your browser:\n\n${authUrl}\n\n`);

  const rl = readline.createInterface({ input, output });
  try {
    const code = (await rl.question("Paste the authorization code here: ")).trim();
    if (!code) throw new Error("No code provided.");
    await exchangeCodeAndStoreToken(oAuth2Client, code);
    output.write("\nSaved token. You can now run the server.\n");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

