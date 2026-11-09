import { expect, test } from "@playwright/test";
import { EMAIL, login } from "./helpers";

test.describe("Autenticação", () => {
  test("rota protegida sem sessão redireciona para o login preservando o destino", async ({ page }) => {
    await page.goto("/parameters");
    await expect(page).toHaveURL(/\/login\?next=%2Fparameters/);
    await expect(page.getByRole("heading", { name: "Motor de Estimativa" })).toBeVisible();
  });

  test("credenciais inválidas mostram erro e mantêm o e-mail", async ({ page }) => {
    await login(page, EMAIL, "senha-errada-e2e");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("E-mail")).toHaveValue(EMAIL);
  });

  test("login com next leva ao destino e logout encerra a sessão", async ({ page }) => {
    await page.goto("/calibration");
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("E-mail").fill(EMAIL);
    await page.getByLabel("Senha").fill(process.env.E2E_PASSWORD ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/calibration$/);
    await expect(page.getByRole("heading", { level: 1, name: "Calibração" })).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
