import { expect, test } from "@playwright/test";

test.describe("Navegação e layout", () => {
  test("painel de projetos mostra indicadores e ação de novo projeto", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Projetos" })).toBeVisible();
    for (const label of ["Projetos ativos", "Estimativas aguardando aprovação", "Projetos sem estimativa"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Novo projeto" })).toHaveAttribute("href", "/projects/new");
  });

  test("menu hambúrguer navega entre as telas e fecha com Esc", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Abrir menu" });
    await toggle.click();
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Projetos" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Calibração" }).click();
    await expect(page).toHaveURL(/\/calibration$/);
    await expect(page.getByRole("heading", { level: 1, name: "Calibração" })).toBeVisible();
    await expect(nav).toBeHidden();

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Parâmetros" }).click();
    await expect(page).toHaveURL(/\/parameters$/);
    await expect(page.getByRole("heading", { level: 1, name: "Parâmetros" })).toBeVisible();

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();
  });

  test("seletor de tema aplica e persiste o tema escuro", async ({ page }) => {
    await page.goto("/");
    const themes = page.getByRole("radiogroup", { name: "Tema" });
    await themes.getByRole("radio", { name: "Escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(themes.getByRole("radio", { name: "Escuro" })).toHaveAttribute("aria-checked", "true");
    await themes.getByRole("radio", { name: "Claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await themes.getByRole("radio", { name: "Sistema" }).click();
  });

  test("projeto inexistente responde com página não encontrada", async ({ page }) => {
    // O layout já foi enviado por streaming quando notFound() dispara: o HTTP fica 200, só o conteúdo muda.
    await page.goto("/projects/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
