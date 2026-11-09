// Proxy (antigo middleware): mantém a sessão viva e faz a checagem otimista de autenticação.
// - access token perto do vencimento + refresh token: renova na API (que repassa ao SSO) antes de renderizar;
// - sem sessão utilizável: redireciona para /login. A autorização de verdade é feita pela API em cada chamada.
import { NextResponse, type NextRequest } from "next/server";
import { expiresSoon } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from "@/lib/session";
import type { TokenResponse } from "@/lib/api/types";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";
const REFRESH_MAX_AGE = 7 * 24 * 3600;

async function refreshTokens(refreshToken: string): Promise<TokenResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return response.ok ? ((await response.json()) as TokenResponse) : null;
  } catch {
    return null;
  }
}

function toLogin(request: NextRequest): NextResponse {
  const url = new URL("/login", request.nextUrl);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target !== "/") url.searchParams.set("next", target);
  const response = NextResponse.redirect(url);
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (access && !expiresSoon(access)) return NextResponse.next();

  if (refresh) {
    const tokens = await refreshTokens(refresh);
    if (tokens) {
      // Atualiza o cookie da própria requisição para a renderização atual já usar o token novo.
      request.cookies.set(ACCESS_COOKIE, tokens.access_token);
      if (tokens.refresh_token) request.cookies.set(REFRESH_COOKIE, tokens.refresh_token);
      const response = NextResponse.next({ request: { headers: request.headers } });
      response.cookies.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(tokens.expires_in));
      if (tokens.refresh_token) {
        response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(REFRESH_MAX_AGE));
      }
      return response;
    }
    // Refresh recusado (ex.: outra aba já rotacionou o token), mas o access ainda vale: segue com ele.
    if (access && !expiresSoon(access, 0)) return NextResponse.next();
  }

  return isLogin ? NextResponse.next() : toLogin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
