// Formatação pt-BR para horas, moeda, percentuais e datas.

const number1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const percent1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function fmtHours(value: number | null | undefined): string {
  if (value == null) return "—";
  // Arredonda antes de formatar: -0 e valores como -0,04 viram "0 h", não "-0 h".
  const rounded = Math.round(value * 10) / 10;
  return `${number1.format(rounded === 0 ? 0 : rounded)} h`;
}

export function fmtMoney(value: number | null | undefined, currency = "BRL"): string {
  if (value == null) return "não contabilizado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

/** Percentual a partir de número já em % (ex.: 4.25 -> "4,3%"). */
export function fmtPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${percent1.format(value)}%`;
}

/** Percentual a partir de fração (ex.: 0.15 -> "15%"). */
export function fmtShare(value: number | null | undefined): string {
  return value == null ? "—" : `${percent1.format(value * 100)}%`;
}

export function fmtDate(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "—";
}

export const ROLE_LABELS: Record<string, string> = {
  desenvolvimento: "Desenvolvimento",
  qa: "QA",
  devsecops: "DevSecOps",
  product_owner: "Product Owner",
};

export const SENIORITY_LABELS: Record<string, string> = { junior: "Júnior", pleno: "Pleno", senior: "Sênior" };

export const PROFILE_LABELS: Record<string, string> = {
  admin: "Administrador",
  tech_leader: "Tech Leader",
  product_owner: "Product Owner",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovada",
  active: "Ativo",
  archived: "Arquivado",
};
