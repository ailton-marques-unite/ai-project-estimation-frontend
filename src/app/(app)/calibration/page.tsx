import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, PageHeader, Stat } from "@/components/ui";
import type { CalibrationGroup } from "@/lib/api/types";
import { getCalibration, getCurrentParameters } from "@/lib/dal";
import { fmtHours, fmtPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Calibração" };

function ratioText(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(ratio)}×`;
}

function GroupTable({ title, groups, labels, note }: { title: string; groups: CalibrationGroup[]; labels: Record<string, string>; note: string }) {
  return (
    <Card title={title}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem horas realizadas registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm [&_td+td]:pl-4 [&_th+th]:pl-4 [&_th]:whitespace-nowrap">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium" />
                <th className="py-2 text-right font-medium">Atividades</th>
                <th className="py-2 text-right font-medium">Estimado</th>
                <th className="py-2 text-right font-medium">Realizado</th>
                <th className="py-2 text-right font-medium">Realizado ÷ estimado</th>
                <th className="py-2 text-right font-medium">Erro médio</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {groups.map((g) => (
                <tr key={g.key} className="border-t border-border">
                  <td className="py-2 text-foreground">{labels[g.key] ?? g.key}</td>
                  <td className="py-2 text-right text-muted-foreground">{g.count}</td>
                  <td className="py-2 text-right text-foreground">{fmtHours(g.estimated_hours)}</td>
                  <td className="py-2 text-right text-foreground">{fmtHours(g.actual_hours)}</td>
                  <td className="py-2 text-right font-medium text-foreground">{ratioText(g.ratio)}</td>
                  <td className="py-2 text-right text-muted-foreground">{g.mean_abs_pct_error == null ? "—" : fmtPercent(g.mean_abs_pct_error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}

export default async function CalibrationPage() {
  const [report, parameters] = await Promise.all([getCalibration(), getCurrentParameters()]);
  const typeLabels = parameters.content.activity_types;
  const modalityLabels: Record<string, string> = {
    ...Object.fromEntries(Object.entries(parameters.content.ai.modalities).map(([k, m]) => [k, m.label])),
    sem_ia: "Sem IA",
  };
  const o = report.overall;

  return (
    <>
      <PageHeader
        title="Calibração"
        subtitle="Estimado × realizado nas estimativas aprovadas. Cada atividade é comparada com o cenário que de fato aconteceu (com ou sem IA), sem contingência."
      />
      <div className="flex flex-col gap-6">
        {o.count === 0 ? (
          <Alert tone="warning">
            Ainda não há horas realizadas. Registre-as no fim de cada funcionalidade, na página de uma estimativa aprovada
            (cartão “Horas realizadas”).
          </Alert>
        ) : (
          report.small_sample && (
            <Alert tone="warning">
              Amostra pequena ({o.count} atividade(s) em {report.estimates_count} estimativa(s)). Use os números para levantar
              hipóteses; para recalibrar parâmetros, acumule ao menos 10 a 20 funcionalidades de complexidades diferentes.
            </Alert>
          )
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Atividades medidas" value={o.count} note={`${report.estimates_count} estimativa(s) aprovada(s)`} />
          <Stat label="Estimado" value={fmtHours(o.estimated_hours)} />
          <Stat label="Realizado" value={fmtHours(o.actual_hours)} />
          <Stat
            label="Realizado ÷ estimado"
            value={ratioText(o.ratio)}
            note={o.mean_abs_pct_error == null ? undefined : `erro médio por atividade: ${fmtPercent(o.mean_abs_pct_error)}`}
          />
        </div>

        <div className="flex flex-col gap-6">
          <GroupTable
            title="Por tipo de atividade"
            groups={report.by_activity_type}
            labels={typeLabels}
            note="Razão acima de 1 indica estimativa otimista para o tipo: candidato a revisar horas de referência ou contingência."
          />
          <GroupTable
            title="Por modalidade de IA usada"
            groups={report.by_ai_modality}
            labels={modalityLabels}
            note="Compare cada modalidade com “Sem IA”: indica se os fatores de redução, revisão e retrabalho (hipóteses) se confirmam."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Para aplicar um ajuste, cadastre uma nova versão em{" "}
          <Link href="/parameters" className="underline">
            Parâmetros
          </Link>{" "}
          e altere o status de validação do que foi confirmado. Versões antigas continuam reproduzíveis.
        </p>
      </div>
    </>
  );
}
