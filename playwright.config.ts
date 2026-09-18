import { defineConfig, devices } from "playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SYNAPSE_E2E_BASE_URL ?? "http://127.0.0.1:3001"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev --workspace @synapse/web",
        url: "http://127.0.0.1:3001/demo",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
