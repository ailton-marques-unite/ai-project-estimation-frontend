"use client";
// Barras horizontais agrupadas: cenário sem IA (série 1) × com IA (série 2) por categoria.
// Legenda sempre visível, tooltip por categoria (hover e foco), eixo com valores redondos e tabela alternativa.
import { useState } from "react";
import { fmtHours, fmtMoney } from "@/lib/format";
import { cx } from "@/components/ui";

export type CompareDatum = { label: string; base: number; ai: number };
type Unit = "hours" | "money";

const SERIES = [
  { key: "base", name: "Sem IA", color: "var(--series-1)" },
  { key: "ai", name: "Com IA", color: "var(--series-2)" },
] as const;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

export function CompareBars({ title, data, unit = "hours", currency = "BRL" }: { title: string; data: CompareDatum[]; unit?: Unit; currency?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const format = (v: number) => (unit === "money" ? fmtMoney(v, currency) : fmtHours(v));
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.base, d.ai])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const axisLabel = (v: number) =>
    unit === "money"
      ? new Intl.NumberFormat("pt-BR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v)
      : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="flex items-center gap-4 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.name}
            </span>
          ))}
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Ver gráfico" : "Ver tabela"}
          </button>
        </span>
      </figcaption>

      {showTable ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 font-medium" />
              <th className="py-1.5 text-right font-medium">Sem IA</th>
              <th className="py-1.5 text-right font-medium">Com IA</th>
              <th className="py-1.5 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((d) => (
              <tr key={d.label} className="border-t border-border">
                <td className="py-1.5 text-foreground">{d.label}</td>
                <td className="py-1.5 text-right text-foreground">{format(d.base)}</td>
                <td className="py-1.5 text-right text-foreground">{format(d.ai)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{format(d.ai - d.base)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-[minmax(96px,30%)_1fr] gap-x-3">
          {data.map((d, i) => (
            <div key={d.label} className="contents">
              <div className="flex items-center py-2 pr-1 text-xs text-muted-foreground">{d.label}</div>
              <div
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: sem IA ${format(d.base)}, com IA ${format(d.ai)}`}
                className="relative flex flex-col justify-center gap-[2px] py-2 outline-none focus-visible:outline-2 focus-visible:outline-ring"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {ticks.map((t) => (
                  <span
                    key={t}
                    aria-hidden
                    className={cx("absolute inset-y-0 w-px", t === 0 ? "bg-ring" : "bg-border")}
                    style={{ left: `${(t / max) * 100}%` }}
                  />
                ))}
                {SERIES.map((s) => (
                  <span
                    key={s.key}
                    aria-hidden
                    className={cx("relative block h-3 rounded-r transition-opacity", active !== null && active !== i && "opacity-40")}
                    style={{ width: `${Math.max((d[s.key] / max) * 100, d[s.key] > 0 ? 0.5 : 0)}%`, background: s.color }}
                  />
                ))}
                {active === i && (
                  <div className="pointer-events-none absolute left-2 top-full z-20 mt-1 min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                    <div className="mb-1 text-muted-foreground">{d.label}</div>
                    {SERIES.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="inline-block h-0.5 w-3" style={{ background: s.color }} aria-hidden />
                          {s.name}
                        </span>
                        <strong className="tabular text-foreground">{format(d[s.key])}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div />
          <div className="relative h-5 text-[11px] text-muted-foreground tabular" aria-hidden>
            {ticks.map((t, i) => (
              <span
                key={t}
                className="absolute top-1"
                style={{ left: `${(t / max) * 100}%`, transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {axisLabel(t)}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}
