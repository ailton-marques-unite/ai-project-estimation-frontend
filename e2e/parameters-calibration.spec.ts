import { expect, test } from "@playwright/test";
import { card, currentProfile, gotoReady } from "./helpers";

test.describe("Parâmetros", () => {
  test("mostra versão vigente, taxas, modalidades e histórico", async ({ page }) => {
    await page.goto("/parameters");
    // Versão vigente precisa ter identificador (config_version) não vazio.
    await expect(page.getByText(/Versão vigente \S+ · desde/)).toBeVisible();
    await expect(card(page, "Taxas horárias (custo interno)").getByRole("row")).not.toHaveCount(0);
    await expect(card(page, "Contingência e PERT").getByText("Contingência padrão")).toBeVisible();
    await expect(card(page, "Modalidades de IA").locator("tbody tr")).not.toHaveCount(0);
    await expect(card(page, "Histórico de versões").getByText("Vigente")).toBeVisible();
  });

  test("formulário de nova versão: visível só para admin e rejeita JSON inválido", async ({ page }) => {
    await gotoReady(page, "/parameters");
    const profile = await currentProfile(page);
    const form = card(page, "Nova versão de parâmetros");
    if (profile !== "admin") {
      await expect(form).toHaveCount(0);
      return;
    }
    await form.getByLabel("Parâmetros (JSON)").fill("{ isto não é json");
    await form.getByRole("button", { name: "Cadastrar versão" }).click();
    await expect(form.getByRole("alert")).toHaveText("O conteúdo não é um JSON válido.");
  });
});

test.describe("Calibração", () => {
  test("mostra indicadores e tabelas por tipo e por modalidade", async ({ page }) => {
    await page.goto("/calibration");
    await expect(page.getByRole("heading", { level: 1, name: "Calibração" })).toBeVisible();
    for (const label of ["Atividades medidas", "Estimado", "Realizado", "Realizado ÷ estimado"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(card(page, "Por tipo de atividade")).toBeVisible();
    await expect(card(page, "Por modalidade de IA usada")).toBeVisible();
  });
});
