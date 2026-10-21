import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the dev server with the payment simulator (no Stripe keys)
 * and the CJ mock client, using a dedicated database (shop_e2e). Nothing real is charged or ordered.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", launchOptions: executablePath ? { executablePath } : {} },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "npx dotenv -e .env.e2e -- next dev -p 3100",
    url: "http://localhost:3100/robots.txt",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
