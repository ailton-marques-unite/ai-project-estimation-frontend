import { expect, test, type Page } from "@playwright/test";
import { card, currentProfile, gotoReady, type Profile } from "./helpers";

// Fluxo completo de um projeto criado pelo teste. A API não tem DELETE: no fim o projeto é arquivado.
// Aprovar e registrar horas realizadas altera a calibração de forma permanente: só com E2E_APPROVE=1.
const APPROVE = process.env.E2E_APPROVE === "1";
const PROJECT_NAME = `E2E Playwright ${new Date().toISOString().replace(/[:.]/g, "-")}`;

test.describe.configure({ mode: "serial" });

let projectUrl = "";
let estimateUrl = "";
let profile: Profile;

const saveScope = (page: Page) => page.getByRole("button", { name: "Salvar escopo" });

test("cria um projeto e abre a página dele", async ({ page }) => {
  await page.goto("/");
  profile = await currentProfile(page);
  await page.getByRole("link", { name: "Novo projeto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Novo projeto" })).toBeVisible();

  await page.getByLabel("Nome do projeto").fill(PROJECT_NAME);
  await page.getByLabel("Objetivo de negócio").fill("Projeto criado pela suíte E2E do Playwright.");
  await page.getByRole("button", { name: "Criar projeto" }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: PROJECT_NAME })).toBeVisible();
  await expect(card(page, "Estimativas").getByText("Nenhuma estimativa ainda.")).toBeVisible();
  await expect(page.getByText("Nenhuma funcionalidade. Adicione a primeira para começar a estimar.")).toBeVisible();
  await expect(saveScope(page)).toBeDisabled();
  projectUrl = page.url();
});

test("novo projeto aparece no painel como sem estimativa", async ({ page }) => {
  await page.goto("/");
  const item = page.getByRole("link").filter({ hasText: PROJECT_NAME });
  await expect(item).toBeVisible();
  await expect(item.getByText("Sem estimativa")).toBeVisible();
});

test("salva os dados do projeto", async ({ page }) => {
  await gotoReady(page, projectUrl);
  const details = card(page, "Dados do projeto");
  await details.getByLabel("Objetivo de negócio").fill("Objetivo atualizado pelo E2E.");
  await expect(details.getByLabel("Objetivo de negócio")).toHaveValue("Objetivo atualizado pelo E2E.");
  await details.getByRole("button", { name: "Salvar dados" }).click();
  await expect(details.getByRole("status")).toHaveText("Dados do projeto salvos.");
  await page.reload();
  await expect(card(page, "Dados do projeto").getByLabel("Objetivo de negócio")).toHaveValue("Objetivo atualizado pelo E2E.");
});

test("editor de escopo: funcionalidade, validação de horas, equipe e custo", async ({ page }) => {
  await gotoReady(page, projectUrl);
  const technical = profile !== "product_owner";
  if (!technical) {
    await expect(page.getByText(/Como Product Owner, você cadastra funcionalidades/)).toBeVisible();
  }

  await page.getByRole("button", { name: "+ Funcionalidade" }).click();
  await expect(page.getByText("Alterações não salvas")).toBeVisible();
  await expect(saveScope(page)).toBeEnabled();
  await page.getByLabel("Nome da funcionalidade").fill("Cadastro de clientes");
  await page.getByLabel("Complexidade preliminar").selectOption("media");
  await page.getByLabel("Critérios de aceite", { exact: true }).fill("Cliente salvo com CPF válido.");

  if (technical) {
    await expect(page.getByLabel("Atividade", { exact: true })).toHaveValue("Nova atividade");
    await page.getByLabel("Atividade", { exact: true }).fill("Implementar formulário");

    // O ≤ M ≤ P
    await page.getByLabel("Horas otimistas").fill("10");
    await expect(page.getByText("Use otimista ≤ mais provável ≤ pessimista.")).toBeVisible();
    await page.getByLabel("Horas otimistas").fill("4");
    await page.getByLabel("Horas mais prováveis").fill("8");
    await page.getByLabel("Horas pessimistas").fill("16");
    await expect(page.getByText("Use otimista ≤ mais provável ≤ pessimista.")).toBeHidden();

    // Equipe soma 100%; um percentual diferente é sinalizado no botão.
    await page.getByRole("button", { name: /^Equipe/ }).click();
    await expect(page.getByText("Total 100%")).toBeVisible();
    await page.getByLabel("Percentual").fill("80");
    await expect(page.getByRole("button", { name: "Equipe (80%)" })).toBeVisible();
    await page.getByLabel("Percentual").fill("100");
    await expect(page.getByText("Total 100%")).toBeVisible();
  }

  await page.getByRole("button", { name: "+ Custo" }).click();
  await page.getByLabel("Descrição do custo").fill("Licença de ferramenta");
  await expect(page.getByLabel("Valor")).toHaveAttribute("placeholder", "a confirmar");

  await saveScope(page).click();
  await expect(page.getByText(/^Escopo salvo \(revisão \d+\)\.$/)).toBeVisible();
  await expect(page.getByText("Alterações não salvas")).toBeHidden();
  await expect(saveScope(page)).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("Nome da funcionalidade")).toHaveValue("Cadastro de clientes");
  await expect(page.getByLabel("Descrição do custo")).toHaveValue("Licença de ferramenta");
  if (technical) await expect(page.getByLabel("Horas pessimistas")).toHaveValue("16");
});

test("gera estimativa e mostra o resultado", async ({ page }) => {
  test.skip(profile === "product_owner", "PO não cadastra atividades: não há o que estimar");
  await gotoReady(page, projectUrl);
  await card(page, "Estimativas").getByRole("button", { name: "Gerar estimativa" }).click();

  await expect(page).toHaveURL(/\/estimates\/[0-9a-f-]{36}$/);
  estimateUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: `${PROJECT_NAME} · estimativa v1` })).toBeVisible();
  await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();
  for (const label of ["Esforço sem IA", "Esforço com IA", "Custo sem IA", "Custo com IA"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  const activities = card(page, "Atividades");
  await expect(activities.getByText("Implementar formulário")).toBeVisible();
  await expect(activities.getByText("Cadastro de clientes › Nova tarefa")).toBeVisible();

  const premises = card(page, "Premissas e alertas");
  await expect(premises.getByText("recalcular o snapshot dá o mesmo resultado.")).toBeVisible();
  await expect(card(page, "Custos adicionais").getByText("a confirmar")).toBeVisible();

  // Gráfico com tabela alternativa
  const chart = page.locator("figure").filter({ hasText: "Esforço por papel" });
  await chart.getByRole("button", { name: "Ver tabela" }).click();
  await expect(chart.getByRole("columnheader", { name: "Diferença" })).toBeVisible();
  await chart.getByRole("button", { name: "Ver gráfico" }).click();
  await expect(chart.getByRole("img").first()).toBeVisible();

  await gotoReady(page, projectUrl);
  const list = card(page, "Estimativas");
  await expect(list.getByText("Versão 1")).toBeVisible();
  await expect(list.getByText("Rascunho")).toBeVisible();
});

test("alterar o escopo deixa a estimativa desatualizada e bloqueia a aprovação", async ({ page }) => {
  test.skip(!estimateUrl, "sem estimativa gerada");
  await gotoReady(page, projectUrl);
  await page.getByLabel("Descrição e premissas do escopo").fill("Escopo revisado após a v1.");
  await saveScope(page).click();
  await expect(page.getByText(/^Escopo salvo \(revisão \d+\)\.$/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Os requisitos mudaram desde a última estimativa; ela não pode mais ser aprovada.")).toBeVisible();

  await page.goto(estimateUrl);
  await expect(page.getByText(/Os requisitos do projeto mudaram depois desta estimativa/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar estimativa" })).toHaveCount(0);
});

test("aprova nova estimativa e registra horas realizadas", async ({ page }) => {
  test.skip(!APPROVE, "defina E2E_APPROVE=1 (altera a calibração de forma permanente)");
  test.skip(profile === "product_owner" || !estimateUrl, "só Tech Leader/admin aprovam");
  await gotoReady(page, projectUrl);
  await card(page, "Estimativas").getByRole("button", { name: "Gerar estimativa" }).click();
  await expect(page).toHaveURL(/\/estimates\//);
  await expect(page.getByRole("heading", { level: 1, name: /estimativa v2$/ })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Aprovar estimativa" }).click();
  await expect(page.getByText(/Aprovada em .+\. Esta versão é imutável\./)).toBeVisible();

  const actuals = card(page, "Horas realizadas");
  await actuals.getByLabel("Horas realizadas de Implementar formulário").fill("10");
  await actuals.getByLabel("Observações de Implementar formulário").fill("Registro do E2E");
  await actuals.getByRole("button", { name: "Salvar horas realizadas" }).click();
  await expect(actuals.getByText("1 atividade(s) registrada(s).")).toBeVisible();
});

test("arquiva o projeto (limpeza) e o editor fica somente leitura", async ({ page }) => {
  test.skip(!projectUrl, "projeto não foi criado");
  await gotoReady(page, projectUrl);
  const details = card(page, "Dados do projeto");
  await details.getByLabel("Situação").selectOption("archived");
  await details.getByRole("button", { name: "Salvar dados" }).click();
  await expect(details.getByRole("status")).toHaveText("Dados do projeto salvos.");

  await page.reload();
  await expect(page.getByText("Arquivado", { exact: true }).first()).toBeVisible();
  await expect(saveScope(page)).toHaveCount(0);
  await expect(card(page, "Estimativas").getByRole("button", { name: "Gerar estimativa" })).toHaveCount(0);
  await expect(page.getByLabel("Nome da funcionalidade")).toBeDisabled();

  await page.goto("/");
  await expect(page.getByRole("link").filter({ hasText: PROJECT_NAME }).getByText("Arquivado")).toBeVisible();
});
