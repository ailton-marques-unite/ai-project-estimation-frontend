// Cliente tipado da API (openapi-fetch + tipos gerados do OpenAPI). Só roda no servidor.
import "server-only";
import createClient from "openapi-fetch";
import { redirect } from "next/navigation";
import { readTokens } from "@/lib/session";
import type { paths } from "./schema";

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * O openapi-fetch entrega um Request já montado; o fetch do Next.js falha ao reenviar o corpo desse
 * Request dentro de Server Actions ("expected non-null body source"). Repassa URL, cabeçalhos e corpo.
 */
async function fetchFromRequest(request: Request): Promise<Response> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });
}

/** Cliente sem autenticação (login e refresh). */
export function publicApi() {
  return createClient<paths>({ baseUrl: API_BASE_URL, fetch: fetchFromRequest });
}

/** Cliente autenticado com o access token da sessão; sem sessão, vai para o login. */
export async function api() {
  const { access } = await readTokens();
  if (!access) redirect("/login");
  return createClient<paths>({
    baseUrl: API_BASE_URL,
    fetch: fetchFromRequest,
    headers: { Authorization: `Bearer ${access}` },
  });
}

/** Mensagem legível de um erro da API: detail texto (regras do motor/SSO) ou lista do Pydantic. */
export function errorMessage(error: unknown, fallback = "Erro inesperado na API."): string {
  const detail = (error as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: { loc?: (string | number)[]; msg?: string }) => {
        const where = (item.loc ?? []).filter((part) => part !== "body").join(" › ");
        return where ? `${where}: ${item.msg}` : item.msg;
      })
      .join("\n");
  }
  return fallback;
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Devolve os dados ou lança ApiError; 401 (sessão inválida) leva ao login. */
export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (response.status === 401) redirect("/login?sessao=expirada");
  if (!response.ok || data === undefined) {
    throw new ApiError(response.status, errorMessage(error, `Erro ${response.status} na API.`));
  }
  return data;
}
