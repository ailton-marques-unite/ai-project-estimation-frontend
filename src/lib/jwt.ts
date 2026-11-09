// Leitura do exp de um JWT sem verificar a assinatura (a validação é feita pela API, via SSO).
// Usado pelo proxy para decidir quando renovar o access token.

export function tokenExpiry(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/** Verdadeiro se o token vence em até `marginSeconds` (ou se não dá para ler o exp). */
export function expiresSoon(token: string, marginSeconds = 60): boolean {
  const exp = tokenExpiry(token);
  return exp === null || exp - Date.now() / 1000 <= marginSeconds;
}
