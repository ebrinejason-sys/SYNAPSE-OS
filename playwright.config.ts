import { defineConfig, devices } from "playwright/test"
import { logPlaywrightTarget, vercelProtectionBypassHeaders } from "./scripts/e2e-target.mjs"

const target = logPlaywrightTarget()

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: target.baseURL,
    extraHTTPHeaders: vercelProtectionBypassHeaders(),
    trace: "retain-on-failure",
  },
  webServer: target.startWebServer
    ? {
        command: "npm run dev --workspace @synapse/web",
        url: "http://127.0.0.1:3001/demo",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
