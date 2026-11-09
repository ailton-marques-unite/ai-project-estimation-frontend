import { defineConfig, devices } from "@playwright/test";

// Testes E2E contra o app já rodando (npm run dev + API + SSO). Credenciais via E2E_EMAIL / E2E_PASSWORD.
// O SSO limita o login a 5 tentativas a cada 15 minutos por IP: a sessão é feita uma vez (auth.setup.ts),
// reaproveitada entre execuções enquanto for válida, e os testes rodam em um só worker (o refresh token é rotativo).
export const STORAGE_STATE = "e2e/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testIgnore: /auth\.spec\.ts/,
    },
    // Login inválido, redirecionamento e logout: sem sessão salva (cada login gasta uma tentativa no SSO).
    {
      name: "auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
});
