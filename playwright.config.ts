import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/travelapp/",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/travelapp/",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
