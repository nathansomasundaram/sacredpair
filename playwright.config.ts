import { defineConfig, devices } from "@playwright/test";

// Use the same local settings as the app (Supabase URL and keys).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: helpers fall back to local Supabase defaults.
}

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Optional: point at an installed Chrome instead of Playwright's download.
    launchOptions: { executablePath: process.env.CHROME_PATH || undefined },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Starts the production build unless BASE_URL points at a running server
  // (for example the Docker container or a Vercel preview).
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
      },
});
