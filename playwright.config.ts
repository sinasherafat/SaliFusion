import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4181";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: { baseURL, trace: "retain-on-failure", viewport: { width: 1600, height: 1000 } },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: { command: "next dev --webpack --port 4181", url: `${baseURL}/`, reuseExistingServer: true, timeout: 180_000 },
});
