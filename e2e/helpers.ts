import { expect, type Page } from "@playwright/test";

export const EMAIL = process.env.E2E_EMAIL ?? "";
export const PASSWORD = process.env.E2E_PASSWORD ?? "";

export async function login(page: Page, email = EMAIL, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export type Profile = "admin" | "tech_leader" | "product_owner";

/** Perfil do usuário logado, lido do cabeçalho. */
export async function currentProfile(page: Page): Promise<Profile> {
  const header = page.locator("header").first();
  await expect(header.getByRole("button", { name: "Sair" })).toBeVisible();
  const text = await header.innerText();
  if (text.includes("Administrador")) return "admin";
  if (text.includes("Tech Leader")) return "tech_leader";
  return "product_owner";
}

export function card(page: Page, title: string | RegExp) {
  return page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title }) });
}

/** Navega e espera a hidratação: preencher um formulário SSR antes dela pode misturar valores no campo. */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}
