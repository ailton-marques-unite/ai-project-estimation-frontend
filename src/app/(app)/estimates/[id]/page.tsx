import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveEstimate } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { ActualsEditor } from "@/components/actuals-editor";
import { CompareBars, type CompareDatum } from "@/components/compare-bars";
import { Alert, Badge, Card, PageHeader, Stat } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import type { EstimateResult } from "@/lib/api/types";
import { checkReproduction, getCurrentParameters, getCurrentUser, getEstimate, getProject, listActuals } from "@/lib/dal";
import { fmtDate, fmtHours, fmtMoney, fmtPercent, fmtShare, ROLE_LABELS, SENIORITY_LABELS, STATUS_LABELS } from "@/lib/format";

export const metadata: Metadata = { title: "Estimativa" };


function roleLabel(key: string): string {
  const [role, seniority] = key.split("/");
  return `${ROLE_LABELS[role] ?? role} ${SENIORITY_LABELS[seniority] ?? seniority}`.trim();
}

/** Horas por papel (somando senioridades), na ordem de maior esforço sem IA. */
function byRole(result: EstimateResult): CompareDatum[] {
  const totals = new Map<string, CompareDatum>();
  for (const [key, value] of Object.entries(result.hours_and_cost_by_role_seniority)) {
    const role = key.split("/")[0];
    const current = totals.get(role) ?? { label: ROLE_LABELS[role] ?? role, base: 0, ai: 0 };
    current.base += value.base_hours;
    current.ai += value.ai_hours;
    totals.set(role, current);
  }
  return [...totals.values()].filter((d) => d.base > 0 || d.ai > 0).sort((a, b) => b.base - a.base);
}

function fromPairs(pairs: Record<string, { base_hours: number; ai_hours: number }>, labels: Record<string, string>): CompareDatum[] {
  return Object.entries(pairs)
    .map(([key, v]) => ({ label: labels[key] ?? key, base: v.base_hours, ai: v.ai_hours }))
    .sort((a, b) => b.base - a.base);
}

function Delta({ saved, percent }: { saved: number; percent: number }) {
  // Positivo = economia; negativo = a IA aumentou o esforço/custo (o motor não força economia).
  const tone = saved >= 0 ? "text-success" : "text-destructive";
  return (
    <span className={tone}>
      {saved >= 0 ? "▼" : "▲"} {fmtPercent(Math.abs(percent))} {saved >= 0 ? "de economia" : "de aumento"}
    </span>
  );
}

export default async function EstimatePage({ params }: PageProps<"/estimates/[id]">) {
  const { id } = await params;
  const estimate = await getEstimate(id).catch((error: unknown) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  });
  const approved = estimate.status === "approved";
  const [project, user, reproduction, parameters, actuals] = await Promise.all([
    getProject(estimate.project_id),
    getCurrentUser(),
    checkReproduction(id),
    getCurrentParameters(),
    approved ? listActuals(id) : Promise.resolve([]),
  ]);
  const result = estimate.result;
  const s = result.summary;
  const a = result.assumptions;
  const currency = result.currency;
  const canApprove = estimate.status === "draft" && (user.profile === "tech_leader" || user.profile === "admin");
  const stale = estimate.project_revision !== project.revision;
  const typeLabels = parameters.content.activity_types;
  const modalityLabels = Object.fromEntries(
    Object.entries(parameters.content.ai.modalities).map(([key, m]) => [key, m.label]),
  ) as Record<string, string>;
  modalityLabels.sem_ia = "Sem IA";
  const costLabels = Object.fromEntries(Object.entries(parameters.content.cost_types).map(([k, v]) => [k, v.label]));

  return (
    <>
      <PageHeader
        title={`${project.name} · estimativa v${estimate.version}`}
        subtitle={`Gerada em ${fmtDate(estimate.created_at)} · requisitos rev. ${estimate.project_revision} · parâmetros ${estimate.parameters_version} · motor ${estimate.engine_version}`}
        back={{ href: `/projects/${project.id}`, label: project.name }}
        actions={<Badge tone={estimate.status === "approved" ? "good" : "warning"}>{STATUS_LABELS[estimate.status]}</Badge>}
      />

      <div className="flex flex-col gap-6">
        {estimate.status === "approved" ? (
          <Alert tone="success">Aprovada em {fmtDate(estimate.approved_at)}. Esta versão é imutável.</Alert>
        ) : stale ? (
          <Alert tone="warning">
            Os requisitos do projeto mudaram depois desta estimativa (revisão atual {project.revision}). Gere uma nova estimativa
            para poder aprovar.
          </Alert>
        ) : canApprove ? (
          <Card>
            <ActionForm
              action={approveEstimate.bind(null, estimate.id)}
              submitLabel="Aprovar estimativa"
              pendingLabel="Aprovando…"
              confirm="Aprovar esta estimativa? Depois de aprovada, ela não pode ser alterada."
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground">Revise as premissas e a decomposição antes de aprovar. A aprovação técnica é explícita.</p>
            </ActionForm>
          </Card>
        ) : (
          <Alert tone="warning">Aguardando aprovação técnica (Tech Leader ou administrador).</Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Esforço sem IA" value={fmtHours(s.base_total_hours)} note={`inclui ${fmtHours(s.base_contingency_hours)} de contingência`} />
          <Stat
            label="Esforço com IA"
            value={fmtHours(s.ai_total_hours)}
            note={<Delta saved={s.hours_saved} percent={s.hours_saved_percent} />}
          />
          <Stat label="Custo sem IA" value={fmtMoney(s.base_total_cost, currency)} note="mão de obra + contingência + adicionais" />
          <Stat
            label="Custo com IA"
            value={fmtMoney(s.ai_total_cost, currency)}
            note={<Delta saved={s.cost_savings} percent={s.cost_savings_percent} />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CompareBars title="Esforço por papel" data={byRole(result)} />
          </Card>
          <Card>
            <CompareBars title="Esforço por modalidade de IA" data={fromPairs(result.hours_by_ai_modality, modalityLabels)} />
          </Card>
          <Card>
            <CompareBars title="Esforço por tipo de atividade" data={fromPairs(result.hours_by_activity_type, typeLabels)} />
          </Card>
          <Card title="Premissas e alertas">
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                Faixa de incerteza: <strong className="text-foreground">{fmtHours(s.optimistic_hours)}</strong> (otimista) a{" "}
                <strong className="text-foreground">{fmtHours(s.pessimistic_hours)}</strong> (pessimista), amplitude{" "}
                {fmtHours(s.uncertainty_range_hours)}. Indicador simples, não um intervalo estatístico.
              </li>
              <li>
                Contingência de {fmtShare(a.contingency_rate)} ({a.contingency_source === "project" ? "definida no projeto" : "padrão dos parâmetros"}),
                mostrada à parte das horas-base.
              </li>
              <li>Custos são internos (planejamento). Revisão e retrabalho com IA são proporcionais às horas-base.</li>
              {a.uncounted_costs.length > 0 && (
                <li className="text-warning-text">
                  Custos não contabilizados: {a.uncounted_costs.map((c) => costLabels[c] ?? c).join(", ")}.
                </li>
              )}
              {a.unvalidated_parameters.length > 0 && (
                <li className="text-warning-text">
                  Parâmetros ainda não validados com dados reais: {a.unvalidated_parameters.join(", ")}.
                </li>
              )}
              <li>
                Reprodutibilidade:{" "}
                {reproduction.reproducible ? (
                  <span className="text-success">recalcular o snapshot dá o mesmo resultado.</span>
                ) : (
                  <span className="text-destructive">o recálculo diverge (motor atual {reproduction.engine_version_current}).</span>
                )}
              </li>
            </ul>
          </Card>
        </div>

        <Card title="Atividades">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Atividade</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">IA</th>
                  <th className="py-2 text-right font-medium">Sem IA</th>
                  <th className="py-2 text-right font-medium">Com IA</th>
                  <th className="py-2 text-right font-medium">Diferença</th>
                  <th className="py-2 text-right font-medium">Faixa P−O</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {result.activities.map((row) => (
                  <tr key={`${row.task_id}/${row.activity_id}`} className="border-t border-border align-top">
                    <td className="py-2 pr-3">
                      <div className="text-foreground">{row.activity}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.scope === "transversal" ? "Transversal" : row.feature} › {row.task}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{typeLabels[row.activity_type] ?? row.activity_type}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{modalityLabels[row.ai_modality] ?? row.ai_modality}</td>
                    <td className="py-2 text-right text-foreground">{fmtHours(row.base_hours)}</td>
                    <td className="py-2 text-right text-foreground">{fmtHours(row.ai_hours)}</td>
                    <td className={row.hours_saved >= 0 ? "py-2 text-right text-success" : "py-2 text-right text-destructive"}>
                      {fmtHours(-row.hours_saved)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{fmtHours(row.uncertainty_range_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {approved && (
          <Card
            title="Horas realizadas"
            actions={
              <Link href="/calibration" className="text-sm text-primary hover:underline">
                Ver calibração →
              </Link>
            }
          >
            <ActualsEditor
              estimateId={estimate.id}
              activities={result.activities}
              actuals={actuals}
              modalityLabels={modalityLabels}
              canEdit={user.profile === "tech_leader" || user.profile === "admin"}
            />
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Equipe por papel e senioridade">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium" />
                  <th className="py-1.5 text-right font-medium">Horas sem IA</th>
                  <th className="py-1.5 text-right font-medium">Horas com IA</th>
                  <th className="py-1.5 text-right font-medium">Custo com IA</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {Object.entries(result.hours_and_cost_by_role_seniority).map(([key, v]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="py-1.5 text-foreground">{roleLabel(key)}</td>
                    <td className="py-1.5 text-right text-foreground">{fmtHours(v.base_hours)}</td>
                    <td className="py-1.5 text-right text-foreground">{fmtHours(v.ai_hours)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtMoney(v.ai_labor_cost, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Custos adicionais">
            {result.additional_costs.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item lançado.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="tabular">
                  {result.additional_costs.items.map((item) => (
                    <tr key={item.id ?? item.description} className="border-t border-border first:border-t-0">
                      <td className="py-1.5 text-foreground">
                        {item.description || costLabels[item.cost_type]}
                        <div className="text-xs text-muted-foreground">
                          {costLabels[item.cost_type] ?? item.cost_type} ·{" "}
                          {{ both: "ambos os cenários", base: "só sem IA", ai: "só com IA" }[item.applies_to]}
                        </div>
                      </td>
                      <td className={item.counted ? "py-1.5 text-right text-foreground" : "py-1.5 text-right text-warning-text"}>
                        {item.counted ? fmtMoney(item.amount, currency) : "a confirmar"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Os fatores de produtividade com IA são hipóteses até serem calibrados com dados reais. Ver{" "}
          <Link href="/parameters" className="underline">
            parâmetros
          </Link>
          .
        </p>
      </div>
    </>
  );
}
