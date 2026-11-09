"use server";
// Server Actions: toda mutação passa por aqui e usa o token da sessão (a API valida no SSO).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, errorMessage, publicApi } from "@/lib/api/client";
import type { ActualInput, Decomposition, Parameters, ProjectContent } from "@/lib/api/types";
import { clearTokens, readTokens, storeTokens } from "@/lib/session";

export type ActionState = { error?: string; ok?: string };

function safeNext(value: FormDataEntryValue | null): string {
  const target = typeof value === "string" ? value : "";
  return target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

// Sessão

// O e-mail volta no estado: o React limpa o formulário após a action, e ele vira o valor inicial do campo.
export type LoginState = ActionState & { email?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha.", email };
  const { data, error } = await publicApi().POST("/auth/login", { body: { email, password } });
  if (!data) return { error: errorMessage(error, "Não foi possível entrar."), email };
  await storeTokens(data);
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  const { access, refresh } = await readTokens();
  if (access) {
    // Best-effort: a sessão local é encerrada mesmo se a API/SSO falhar.
    await (await api()).POST("/auth/logout", { body: refresh ? { refresh_token: refresh } : null }).catch(() => undefined);
  }
  await clearTokens();
  redirect("/login");
}

// Projetos

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim() || null;
  if (!name) return { error: "Informe o nome do projeto." };
  // Sem contingência: vale o padrão dos parâmetros até o Tech Leader definir (o PO não pode alterá-la).
  const content: ProjectContent = { features: [], transversal_tasks: [], cost_items: [] };
  const { data, error } = await (await api()).POST("/projects", { body: { name, objective, content } });
  if (!data) return { error: errorMessage(error) };
  revalidatePath("/");
  redirect(`/projects/${data.id}`);
}

export async function updateProjectDetails(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim() || null;
  const status = formData.get("status") === "archived" ? "archived" : "active";
  const { data, error } = await (await api()).PATCH("/projects/{project_id}", {
    params: { path: { project_id: projectId } },
    body: { name, objective, status },
  });
  if (!data) return { error: errorMessage(error) };
  revalidatePath(`/projects/${projectId}`);
  return { ok: "Dados do projeto salvos." };
}

export async function saveProjectContent(projectId: string, content: ProjectContent): Promise<ActionState> {
  const { data, error } = await (await api()).PATCH("/projects/{project_id}", {
    params: { path: { project_id: projectId } },
    body: { content },
  });
  if (!data) return { error: errorMessage(error) };
  revalidatePath(`/projects/${projectId}`);
  return { ok: `Escopo salvo (revisão ${data.revision}).` };
}

/** Sugestão de tarefas/atividades por IA para uma funcionalidade salva. Nada é gravado. */
export async function suggestDecomposition(
  projectId: string,
  featureId: string,
): Promise<{ error?: string; suggestion?: Decomposition }> {
  const { data, error } = await (await api()).POST("/projects/{project_id}/features/{feature_id}/decomposition", {
    params: { path: { project_id: projectId, feature_id: featureId } },
  });
  return data ? { suggestion: data } : { error: errorMessage(error) };
}

// Estimativas

export async function generateEstimate(projectId: string): Promise<ActionState> {
  const { data, error } = await (await api()).POST("/projects/{project_id}/estimates", {
    params: { path: { project_id: projectId } },
  });
  if (!data) return { error: errorMessage(error) };
  revalidatePath(`/projects/${projectId}`);
  redirect(`/estimates/${data.id}`);
}

export async function approveEstimate(estimateId: string): Promise<ActionState> {
  const { data, error } = await (await api()).POST("/estimates/{estimate_id}/approve", {
    params: { path: { estimate_id: estimateId } },
  });
  if (!data) return { error: errorMessage(error) };
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/projects/${data.project_id}`);
  return { ok: "Estimativa aprovada." };
}

// Horas realizadas (estimativa aprovada; Tech Leader ou admin)

export async function saveActuals(estimateId: string, items: ActualInput[]): Promise<ActionState> {
  const { data, error } = await (await api()).PUT("/estimates/{estimate_id}/actuals", {
    params: { path: { estimate_id: estimateId } },
    body: { items },
  });
  if (!data) return { error: errorMessage(error) };
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/calibration");
  return { ok: `${items.length} atividade(s) registrada(s).` };
}

// Parâmetros (admin)

export async function createParameterSet(_: ActionState, formData: FormData): Promise<ActionState> {
  let content: Parameters;
  try {
    content = JSON.parse(String(formData.get("content") ?? ""));
  } catch {
    return { error: "O conteúdo não é um JSON válido." };
  }
  const effective = String(formData.get("effective_at") ?? "");
  const { data, error } = await (await api()).POST("/parameter-sets", {
    body: { content, effective_at: effective ? new Date(effective).toISOString() : null },
  });
  if (!data) return { error: errorMessage(error) };
  revalidatePath("/parameters");
  return { ok: `Versão ${data.version} cadastrada.` };
}
