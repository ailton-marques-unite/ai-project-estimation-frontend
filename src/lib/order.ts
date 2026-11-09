// Ordem de exibição dos catálogos dos parâmetros. A API guarda os parâmetros em JSONB, que não
// preserva a ordem das chaves (reordena as mais curtas primeiro); por isso a ordem vem daqui.

export const ACTIVITY_TYPE_ORDER = ["implementacao", "interface", "integracao", "testes", "seguranca", "infraestrutura"];
export const ROLE_ORDER = ["desenvolvimento", "qa", "devsecops", "product_owner"];
export const SENIORITY_ORDER = ["junior", "pleno", "senior"];
export const MODALITY_ORDER = ["geracao_codigo", "vibe_coding", "qa_assistido", "devsecops_assistido"];
export const COST_TYPE_ORDER = ["infraestrutura", "licencas", "servicos_externos", "ferramentas_ia"];

/** Chaves conhecidas na ordem dada; as demais depois, em ordem alfabética. */
export function orderedKeys(keys: string[], preferred: string[]): string[] {
  const rank = (key: string) => {
    const index = preferred.indexOf(key);
    return index === -1 ? preferred.length : index;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "pt-BR"));
}

export function orderedEntries<T>(record: Record<string, T>, preferred: string[]): [string, T][] {
  return orderedKeys(Object.keys(record), preferred).map((key) => [key, record[key]]);
}
