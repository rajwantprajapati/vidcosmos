import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: `pnpm dev --port ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // The Inngest Dev Server runs the background jobs (F11); `pnpm inngest` starts the same.
      // Bound to this machine only: the dashboard shows every event and its data.
      command: `pnpm --workspace-root exec inngest-cli dev -u ${baseURL}/api/inngest --no-discovery --host 127.0.0.1`,
      url: "http://127.0.0.1:8288",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
