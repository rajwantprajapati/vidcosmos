// Set-up in the development database (MONGODB_URI in the root .env) that no screen can do yet,
// such as putting a workspace at its monthly limit.
import { execFileSync } from "node:child_process";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(webRoot, "../../.env");

/** Sets this month's video counters on the workspace owned by the user with this email. */
export function setVideosUsed(email: string, used: number, reserved = 0) {
  execFileSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      `--env-file-if-exists=${envFile}`,
      "e2e/support/set-videos-used.ts",
      email,
      String(used),
      String(reserved),
    ],
    { cwd: webRoot, stdio: ["ignore", "ignore", "inherit"] },
  );
}
