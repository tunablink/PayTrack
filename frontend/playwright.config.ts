import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import path from "node:path";
const password =
  process.env.E2E_PASSWORD || randomBytes(24).toString("base64url");
process.env.E2E_PASSWORD = password;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.E2E_BROWSER_CHANNEL || "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVERS ? undefined : [
    {
      command:
        process.platform === "win32"
          ? '"..\\.venv\\Scripts\\python.exe" -m tests.e2e_server'
          : "../.venv/bin/python -m tests.e2e_server",
      cwd: path.resolve("..", "backend"),
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      env: { E2E_PASSWORD: password },
      timeout: 30000,
    },
    {
      command: "npm run start",
      url: "http://localhost:3000/login",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
