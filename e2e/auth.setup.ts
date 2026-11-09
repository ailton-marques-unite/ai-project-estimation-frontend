import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";
import { EMAIL, PASSWORD, login } from "./helpers";

setup("autentica e salva a sessão", async ({ browser }) => {
  // Reaproveita a sessão anterior se ainda for aceita (economiza tentativas no SSO).
  if (existsSync(STORAGE_STATE)) {
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await page.goto("/");
    const valid = !page.url().includes("/login");
    await context.close();
    if (valid) return;
  }
  expect(EMAIL, "defina E2E_EMAIL e E2E_PASSWORD").not.toBe("");
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Projetos" })).toBeVisible();
  await context.storageState({ path: STORAGE_STATE });
  await context.close();
});
