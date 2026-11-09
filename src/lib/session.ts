// Sessão do usuário: tokens do SSO em cookies httpOnly, nunca expostos ao JavaScript do navegador.
import "server-only";
import { cookies } from "next/headers";
import type { TokenResponse } from "@/lib/api/types";

export const ACCESS_COOKIE = "me_access";
export const REFRESH_COOKIE = "me_refresh";
const REFRESH_MAX_AGE = 7 * 24 * 3600; // validade do refresh token no SSO

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function storeTokens(tokens: TokenResponse): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(tokens.expires_in));
  if (tokens.refresh_token) {
    store.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(REFRESH_MAX_AGE));
  }
}

export async function clearTokens(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function readTokens(): Promise<{ access?: string; refresh?: string }> {
  const store = await cookies();
  return { access: store.get(ACCESS_COOKIE)?.value, refresh: store.get(REFRESH_COOKIE)?.value };
}
