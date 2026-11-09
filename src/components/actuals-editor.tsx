"use client";
// Registro das horas realizadas por atividade de uma estimativa aprovada (base da calibração dos parâmetros).
import { useState, useTransition } from "react";
import { saveActuals } from "@/app/actions";
import type { Actual, ActivityResult, ActualInput } from "@/lib/api/types";
import { fmtHours, fmtPercent } from "@/lib/format";
import { Alert, buttonClasses, cx } from "@/components/ui";

type Row = { hours: string; aiUsed: boolean; notes: string };
const key = (taskId: string, activityId: string) => `${taskId}/${activityId}`;

export function ActualsEditor({
  estimateId,
  activities,
  actuals,
  modalityLabels,
  canEdit,
}: {
  estimateId: string;
  activities: ActivityResult[];
  actuals: Actual[];
  modalityLabels: Record<string, string>;
  canEdit: boolean;
}) {
  const saved = new Map(actuals.map((a) => [key(a.task_id, a.activity_id), a]));
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      activities.map((activity) => {
        const actual = saved.get(key(activity.task_id, activity.activity_id));
        return [
          key(activity.task_id, activity.activity_id),
          { hours: actual ? String(actual.actual_hours) : "", aiUsed: actual?.ai_used ?? activity.ai_applied, notes: actual?.notes ?? "" },
        ];
      }),
    ),
  );
  const [result, setResult] = useState<{ error?: string; ok?: string }>({});
  const [pending, startTransition] = useTransition();

  function update(k: string, patch: Partial<Row>) {
    setRows((current) => ({ ...current, [k]: { ...current[k], ...patch } }));
    setResult({});
  }

  function save() {
    const items: ActualInput[] = activities
      .filter((a) => rows[key(a.task_id, a.activity_id)].hours.trim() !== "")
      .map((a) => {
        const row = rows[key(a.task_id, a.activity_id)];
        return {
          task_id: a.task_id,
          activity_id: a.activity_id,
          actual_hours: Number(row.hours.replace(",", ".")),
          ai_used: row.aiUsed,
          notes: row.notes.trim() || null,
        };
      });
    if (items.some((i) => !Number.isFinite(i.actual_hours) || i.actual_hours < 0)) {
      setResult({ error: "Informe horas realizadas válidas (números maiores ou iguais a zero)." });
      return;
    }
    if (items.length === 0) {
      setResult({ error: "Preencha as horas realizadas de pelo menos uma atividade." });
      return;
    }
    startTransition(async () => setResult(await saveActuals(estimateId, items)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Atividade</th>
              <th className="py-2 font-medium">Executada com IA?</th>
              <th className="py-2 text-right font-medium">Estimado</th>
              <th className="py-2 text-right font-medium">Realizado (h)</th>
              <th className="py-2 text-right font-medium">Desvio</th>
              <th className="py-2 pl-3 font-medium">Observações</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {activities.map((activity) => {
              const k = key(activity.task_id, activity.activity_id);
              const row = rows[k];
              // Compara com o cenário executado: horas com IA se a IA foi usada, senão sem IA.
              const estimated = row.aiUsed ? activity.ai_hours : activity.base_hours;
              const actual = row.hours.trim() === "" ? null : Number(row.hours.replace(",", "."));
              const deviation = actual != null && Number.isFinite(actual) && estimated > 0 ? ((actual - estimated) / estimated) * 100 : null;
              return (
                <tr key={k} className="border-t border-border align-top">
                  <td className="py-2 pr-3">
                    <div className="text-foreground">{activity.activity}</div>
                    <div className="text-xs text-muted-foreground">
                      {activity.feature} › {activity.task}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={row.aiUsed}
                        disabled={!canEdit || !activity.ai_applied}
                        onChange={(e) => update(k, { aiUsed: e.target.checked })}
                      />
                      {activity.ai_applied ? (modalityLabels[activity.ai_modality] ?? activity.ai_modality) : "Sem IA na estimativa"}
                    </label>
                  </td>
                  <td className="py-2 text-right text-foreground">{fmtHours(estimated)}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      aria-label={`Horas realizadas de ${activity.activity}`}
                      disabled={!canEdit}
                      className="w-24 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 text-right text-foreground disabled:opacity-70"
                      value={row.hours}
                      onChange={(e) => update(k, { hours: e.target.value })}
                    />
                  </td>
                  <td className={cx("py-2 text-right", deviation == null ? "text-muted-foreground" : deviation > 0 ? "text-destructive" : "text-success")}>
                    {deviation == null ? "—" : `${deviation > 0 ? "+" : "−"}${fmtPercent(Math.abs(deviation))}`}
                  </td>
                  <td className="py-2 pl-3">
                    <input
                      aria-label={`Observações de ${activity.activity}`}
                      disabled={!canEdit}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 text-foreground disabled:opacity-70"
                      value={row.notes}
                      onChange={(e) => update(k, { notes: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {result.error && <Alert tone="error">{result.error}</Alert>}
      {result.ok && <Alert tone="success">{result.ok}</Alert>}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClasses.primary} onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar horas realizadas"}
          </button>
          <span className="text-xs text-muted-foreground">Atividades sem horas preenchidas ficam de fora. Desvio positivo = levou mais que o estimado.</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Somente o Tech Leader ou o administrador registram horas realizadas.</p>
      )}
    </div>
  );
}
