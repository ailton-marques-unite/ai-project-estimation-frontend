import type { Metadata } from "next";
import { createParameterSet } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, PageHeader, inputClasses } from "@/components/ui";
import { getCurrentParameters, getCurrentUser, listParameterSets } from "@/lib/dal";
import { fmtDate, fmtMoney, fmtShare, ROLE_LABELS, SENIORITY_LABELS } from "@/lib/format";
import { ACTIVITY_TYPE_ORDER, MODALITY_ORDER, ROLE_ORDER, orderedEntries, orderedKeys } from "@/lib/order";

export const metadata: Metadata = { title: "Parâmetros" };

const STATUS_TONE = { validado: "good", em_validacao: "accent", hipotese: "warning" } as const;
const STATUS_TEXT: Record<string, string> = { validado: "Validado", em_validacao: "Em validação", hipotese: "Hipótese" };

function ValidationBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{STATUS_TEXT[status] ?? "Não informado"}</Badge>;
}

export default async function ParametersPage() {
  const [current, versions, user] = await Promise.all([getCurrentParameters(), listParameterSets(), getCurrentUser()]);
  const p = current.content;
  const provenance = p.provenance ?? {};

  return (
    <>
      <PageHeader
        title="Parâmetros"
        subtitle={`Versão vigente ${current.version} · desde ${fmtDate(current.effective_at)}. Versões são imutáveis; mudanças geram uma nova versão.`}
      />
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Taxas horárias (custo interno)" actions={provenance.roles && <ValidationBadge status={provenance.roles.validation_status} />}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Papel</th>
                  {["junior", "pleno", "senior"].map((s) => (
                    <th key={s} className="py-1.5 text-right font-medium">
                      {SENIORITY_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {orderedEntries(p.roles, ROLE_ORDER).map(([role, rates]) => (
                  <tr key={role} className="border-t border-border">
                    <td className="py-1.5 text-foreground">{ROLE_LABELS[role] ?? role}</td>
                    {["junior", "pleno", "senior"].map((s) => (
                      <td key={s} className="py-1.5 text-right text-foreground">
                        {rates[s] == null ? "—" : fmtMoney(rates[s], p.currency)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {provenance.roles && <p className="mt-3 text-xs text-muted-foreground">Origem: {provenance.roles.source}</p>}
          </Card>

          <Card title="Contingência e PERT">
            <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Contingência padrão</dt>
              <dd className="tabular text-right text-foreground">{fmtShare(p.contingency_rate_default)}</dd>
              <dt className="text-muted-foreground">PERT</dt>
              <dd className="tabular text-right text-foreground">
                (O×{p.pert.optimistic_weight} + M×{p.pert.most_likely_weight} + P×{p.pert.pessimistic_weight}) ÷ {p.pert.divisor}
              </dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(provenance).map(([key, info]) => (
                <span key={key} className="flex items-center gap-1.5">
                  {key} <ValidationBadge status={info.validation_status} />
                </span>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Modalidades de IA">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Modalidade</th>
                  <th className="py-2 font-medium">Tipos de atividade</th>
                  <th className="py-2 text-right font-medium">Elegível</th>
                  <th className="py-2 text-right font-medium">Redução</th>
                  <th className="py-2 text-right font-medium">Revisão</th>
                  <th className="py-2 text-right font-medium">Retrabalho</th>
                  <th className="py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {orderedEntries(p.ai.modalities, MODALITY_ORDER).map(([key, m]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="py-2 text-foreground">{m.label}</td>
                    <td className="py-2 text-muted-foreground">{orderedKeys(m.applicable_activity_types, ACTIVITY_TYPE_ORDER).map((t) => p.activity_types[t] ?? t).join(", ")}</td>
                    <td className="py-2 text-right text-foreground">{fmtShare(m.eligible_share)}</td>
                    <td className="py-2 text-right text-foreground">{fmtShare(m.reduction_rate)}</td>
                    <td className="py-2 text-right text-foreground">{fmtShare(m.review_hours_per_base_hour)}</td>
                    <td className="py-2 text-right text-foreground">{fmtShare(m.rework_hours_per_base_hour)}</td>
                    <td className="py-2 text-right">
                      <ValidationBadge status={m.validation_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Horas com IA = base × (1 − elegível × redução) + base × revisão + base × retrabalho, só nas atividades com modalidade.
          </p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Histórico de versões">
            <ul className="flex flex-col divide-y divide-border text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span className="text-foreground">Versão {v.version}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    vigência {fmtDate(v.effective_at)}
                    {v.id === current.id && <Badge tone="good">Vigente</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {user.profile === "admin" && (
            <Card title="Nova versão de parâmetros">
              <ActionForm action={createParameterSet} submitLabel="Cadastrar versão" pendingLabel="Cadastrando…">
                <p className="text-xs text-muted-foreground">
                  Cole o JSON completo dos parâmetros com um <code>config_version</code> novo. A vigência em branco é imediata.
                </p>
                <Field label="Parâmetros (JSON)">
                  <textarea
                    name="content"
                    rows={10}
                    required
                    defaultValue={JSON.stringify({ ...p, config_version: "" }, null, 2)}
                    className={`${inputClasses} font-mono text-xs`}
                  />
                </Field>
                <Field label="Início da vigência" hint="Opcional; uma data futura agenda a troca.">
                  <input type="datetime-local" name="effective_at" className={inputClasses} />
                </Field>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
