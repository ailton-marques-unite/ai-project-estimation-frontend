"use client";
// Editor do escopo estimável do projeto (funcionalidades, tarefas, atividades, transversais, custos e contingência).
// As opções vêm do conjunto de parâmetros vigente; as regras de cálculo continuam todas na API/motor.
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveProjectContent } from "@/app/actions";
import type { Activity, Catalog, CostItem, Decomposition, ProjectContent, Task } from "@/lib/api/types";
import { DecompositionPanel } from "@/components/decomposition-panel";
import { ROLE_LABELS, SENIORITY_LABELS } from "@/lib/format";
import { ACTIVITY_TYPE_ORDER, COST_TYPE_ORDER, MODALITY_ORDER, ROLE_ORDER, SENIORITY_ORDER, orderedEntries, orderedKeys } from "@/lib/order";
import { Alert, Badge, buttonClasses, cx, inputClasses } from "@/components/ui";

type Props = {
  projectId: string;
  initial: ProjectContent;
  catalog: Catalog;
  readOnly: boolean;
  /** Tech Leader/admin editam a parte técnica; o PO só a visualiza (a API aplica a mesma regra). */
  canEditTechnical: boolean;
};

const COMPLEXITY = [
  ["", "—"],
  ["baixa", "Baixa"],
  ["media", "Média"],
  ["alta", "Alta"],
] as const;
const COST_SCENARIOS = [
  ["", "Padrão do tipo"],
  ["both", "Ambos os cenários"],
  ["base", "Só sem IA"],
  ["ai", "Só com IA"],
] as const;

const label = (labels: Record<string, string>, key: string) => labels[key] ?? key;
const smallInput =
  "rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function collectIds(content: ProjectContent): string[] {
  const ids: string[] = content.cost_items.map((c) => c.id);
  const tasks = [...content.features.flatMap((f) => (ids.push(f.id), f.tasks)), ...content.transversal_tasks];
  for (const task of tasks) {
    ids.push(task.id, ...task.activities.map((a) => a.id));
  }
  return ids;
}

function nextId(content: ProjectContent, prefix: string): string {
  const max = collectIds(content)
    .filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length)))
    .reduce((acc, id) => Math.max(acc, Number(id.slice(prefix.length))), 0);
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ProjectEditor({ projectId, initial, catalog, readOnly, canEditTechnical }: Props) {
  const locked = !canEditTechnical;
  const [content, setContent] = useState<ProjectContent>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [result, setResult] = useState<{ error?: string; ok?: string }>({});
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(content) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const defaults = useMemo(() => {
    const role = orderedKeys(Object.keys(catalog.roles), ROLE_ORDER)[0] ?? "desenvolvimento";
    const seniorities = orderedKeys(Object.keys(catalog.roles[role] ?? { pleno: 0 }), SENIORITY_ORDER);
    const seniority = seniorities.includes("pleno") ? "pleno" : seniorities[0];
    const type = orderedKeys(Object.keys(catalog.activity_types), ACTIVITY_TYPE_ORDER)[0] ?? "implementacao";
    return { type, role, seniority };
  }, [catalog]);

  function edit(mutate: (draft: ProjectContent) => void) {
    setContent((previous) => {
      const draft = structuredClone(previous);
      mutate(draft);
      return draft;
    });
    setResult({});
  }

  function newActivity(draft: ProjectContent, transversal: boolean): Activity {
    return {
      id: nextId(draft, "A"),
      name: "Nova atividade",
      activity_type: defaults.type,
      optimistic_hours: 1,
      most_likely_hours: 2,
      pessimistic_hours: 4,
      allocations: { [defaults.role]: { [defaults.seniority]: 1 } },
      ...(transversal ? { scope_key: `transversal_${nextId(draft, "A").toLowerCase()}` } : {}),
    };
  }

  function newTask(draft: ProjectContent, transversal: boolean): Task {
    const id = nextId(draft, transversal ? "TR" : "T");
    return { id, name: transversal ? "Nova tarefa transversal" : "Nova tarefa", activities: [newActivity(draft, transversal)] };
  }

  async function persist(): Promise<string | null> {
    const snapshot = content;
    const response = await saveProjectContent(projectId, snapshot);
    setResult(response);
    if (!response.error) setSaved(JSON.stringify(snapshot));
    return response.error ?? null;
  }

  function save() {
    startTransition(async () => void (await persist()));
  }

  /** Acrescenta as tarefas sugeridas pela IA à funcionalidade, com ids novos (fica como alteração não salva). */
  function applySuggestion(featureId: string, tasks: Decomposition["tasks"]) {
    edit((d) => {
      const feature = d.features.find((f) => f.id === featureId);
      if (!feature) return;
      for (const suggested of tasks) {
        const task: Task = { id: nextId(d, "T"), name: suggested.name, activities: [] };
        feature.tasks.push(task);
        for (const s of suggested.activities) {
          task.activities.push({
            id: nextId(d, "A"),
            name: s.name,
            activity_type: s.activity_type,
            optimistic_hours: s.optimistic_hours,
            most_likely_hours: s.most_likely_hours,
            pessimistic_hours: s.pessimistic_hours,
            allocations: s.allocations,
            ...(s.ai_modality ? { ai_modality: s.ai_modality } : {}),
          });
        }
      }
    });
  }

  const activityCount = content.features.reduce((n, f) => n + f.tasks.reduce((m, t) => m + t.activities.length, 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="text-sm text-muted-foreground">
          {content.features.length} funcionalidade(s) · {activityCount} atividade(s) ·{" "}
          {content.transversal_tasks.length} tarefa(s) transversal(is)
          {dirty && <span className="ml-2 font-medium text-warning-text">Alterações não salvas</span>}
        </div>
        {!readOnly && (
          <button type="button" onClick={save} disabled={pending || !dirty} className={buttonClasses.primary}>
            {pending ? "Salvando…" : "Salvar escopo"}
          </button>
        )}
      </div>
      {result.error && <Alert tone="error">{result.error}</Alert>}
      {result.ok && <Alert tone="success">{result.ok}</Alert>}
      {locked && !readOnly && (
        <Alert tone="warning">
          Como Product Owner, você cadastra funcionalidades, critérios de aceite e custos. Tarefas, atividades, transversais e
          contingência são definidas na revisão técnica pelo Tech Leader; aqui você as visualiza.
        </Alert>
      )}

      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        <section className="grid gap-4 md:grid-cols-[1fr_200px]">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Descrição e premissas do escopo</span>
            <textarea
              rows={2}
              className={inputClasses}
              value={content.description ?? ""}
              onChange={(e) => edit((d) => void (d.description = e.target.value || null))}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Contingência (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={locked}
              className={cx(inputClasses, "disabled:opacity-70")}
              placeholder="Padrão dos parâmetros"
              value={content.contingency_rate == null ? "" : Math.round(content.contingency_rate * 1000) / 10}
              onChange={(e) =>
                edit((d) => void (d.contingency_rate = e.target.value === "" ? null : toNumber(e.target.value) / 100))
              }
            />
            <span className="text-xs text-muted-foreground">Aplicada separadamente sobre horas e mão de obra.</span>
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Funcionalidades</h2>
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={() =>
                edit((d) =>
                  d.features.push({ id: nextId(d, "F"), name: "Nova funcionalidade", tasks: locked ? [] : [newTask(d, false)] }),
                )
              }
            >
              + Funcionalidade
            </button>
          </div>
          {content.features.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma funcionalidade. Adicione a primeira para começar a estimar.
            </p>
          )}
          {content.features.map((feature, fi) => (
            <div key={feature.id} className="rounded-xl border border-border bg-card p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <input
                  aria-label="Nome da funcionalidade"
                  className={cx(inputClasses, "font-medium")}
                  value={feature.name}
                  onChange={(e) => edit((d) => void (d.features[fi].name = e.target.value))}
                />
                <select
                  aria-label="Complexidade preliminar"
                  className={inputClasses}
                  value={feature.complexity ?? ""}
                  onChange={(e) =>
                    edit((d) => void (d.features[fi].complexity = (e.target.value || null) as typeof feature.complexity))
                  }
                >
                  {COMPLEXITY.map(([value, text]) => (
                    <option key={value} value={value}>
                      Complexidade: {text}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={buttonClasses.ghost}
                  disabled={locked && feature.tasks.length > 0}
                  title={locked && feature.tasks.length > 0 ? "Funcionalidade com tarefas técnicas: só o Tech Leader remove." : undefined}
                  onClick={() => edit((d) => void d.features.splice(fi, 1))}
                >
                  Remover
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <textarea
                  aria-label="Descrição"
                  placeholder="Descrição"
                  rows={2}
                  className={inputClasses}
                  value={feature.description ?? ""}
                  onChange={(e) => edit((d) => void (d.features[fi].description = e.target.value || null))}
                />
                <textarea
                  aria-label="Critérios de aceite"
                  placeholder="Critérios de aceite"
                  rows={2}
                  className={inputClasses}
                  value={feature.acceptance_criteria ?? ""}
                  onChange={(e) => edit((d) => void (d.features[fi].acceptance_criteria = e.target.value || null))}
                />
              </div>
              {!readOnly && (
                <DecompositionPanel
                  projectId={projectId}
                  featureId={feature.id}
                  catalog={catalog}
                  canApply={!locked}
                  dirty={dirty}
                  saveFirst={persist}
                  onApply={(tasks) => applySuggestion(feature.id, tasks)}
                />
              )}
              <div className="mt-4 flex flex-col gap-4">
                {feature.tasks.map((task, ti) => (
                  <TaskEditor
                    key={task.id}
                    task={task}
                    catalog={catalog}
                    locked={locked}
                    transversal={false}
                    onChange={(mutate) => edit((d) => mutate(d.features[fi].tasks[ti], d))}
                    onRemove={() => edit((d) => void d.features[fi].tasks.splice(ti, 1))}
                    onAddActivity={() => edit((d) => void d.features[fi].tasks[ti].activities.push(newActivity(d, false)))}
                  />
                ))}
                {feature.tasks.length === 0 && locked && (
                  <p className="text-xs text-muted-foreground">Sem tarefas técnicas ainda; serão definidas na revisão técnica.</p>
                )}
                {!locked && (
                  <div>
                    <button
                      type="button"
                      className={buttonClasses.ghost}
                      onClick={() => edit((d) => void d.features[fi].tasks.push(newTask(d, false)))}
                    >
                      + Tarefa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Atividades transversais</h2>
              <p className="text-sm text-muted-foreground">
                Trabalho compartilhado pelo projeto (arquitetura, CI/CD, ambientes). Cada atividade tem uma chave de escopo única
                e não pode ser repetida nas funcionalidades.
              </p>
            </div>
            <button
              type="button"
              className={buttonClasses.secondary}
              disabled={locked}
              onClick={() => edit((d) => void d.transversal_tasks.push(newTask(d, true)))}
            >
              + Tarefa transversal
            </button>
          </div>
          {content.transversal_tasks.map((task, ti) => (
            <TaskEditor
              key={task.id}
              task={task}
              catalog={catalog}
              locked={locked}
              transversal
              onChange={(mutate) => edit((d) => mutate(d.transversal_tasks[ti], d))}
              onRemove={() => edit((d) => void d.transversal_tasks.splice(ti, 1))}
              onAddActivity={() => edit((d) => void d.transversal_tasks[ti].activities.push(newActivity(d, true)))}
            />
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Custos adicionais</h2>
              <p className="text-sm text-muted-foreground">
                Valor em branco = a confirmar (aparece como “não contabilizado”, nunca como zero). Tipos sem item também são
                sinalizados.
              </p>
            </div>
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={() =>
                edit((d) =>
                  d.cost_items.push({
                    id: nextId(d, "C"),
                    description: "",
                    cost_type: orderedKeys(Object.keys(catalog.cost_types), COST_TYPE_ORDER)[0] ?? "infraestrutura",
                    amount: null,
                  }),
                )
              }
            >
              + Custo
            </button>
          </div>
          {content.cost_items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Cenário</th>
                    <th className="px-3 py-2 font-medium">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {content.cost_items.map((item, ci) => (
                    <CostRow
                      key={item.id}
                      item={item}
                      catalog={catalog}
                      onChange={(mutate) => edit((d) => mutate(d.cost_items[ci]))}
                      onRemove={() => edit((d) => void d.cost_items.splice(ci, 1))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </fieldset>
    </div>
  );
}

function TaskEditor({
  task,
  catalog,
  locked,
  transversal,
  onChange,
  onRemove,
  onAddActivity,
}: {
  task: Task;
  catalog: Catalog;
  locked: boolean;
  transversal: boolean;
  onChange: (mutate: (task: Task, content: ProjectContent) => void) => void;
  onRemove: () => void;
  onAddActivity: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <fieldset disabled={locked} className="mb-3 flex items-center gap-2">
        <input
          aria-label="Nome da tarefa"
          className={cx(smallInput, "flex-1 font-medium")}
          value={task.name}
          onChange={(e) => onChange((t) => void (t.name = e.target.value))}
        />
        {!locked && (
          <button type="button" className={buttonClasses.ghost} onClick={onRemove}>
            Remover tarefa
          </button>
        )}
      </fieldset>
      <div className="flex flex-col gap-2">
        {task.activities.map((activity, ai) => (
          <ActivityEditor
            key={activity.id}
            activity={activity}
            catalog={catalog}
            locked={locked}
            transversal={transversal}
            onChange={(mutate) => onChange((t) => mutate(t.activities[ai]))}
            onRemove={() => onChange((t) => void t.activities.splice(ai, 1))}
          />
        ))}
      </div>
      {!locked && (
        <button type="button" className={cx(buttonClasses.ghost, "mt-2")} onClick={onAddActivity}>
          + Atividade
        </button>
      )}
    </div>
  );
}

function ActivityEditor({
  activity,
  catalog,
  locked,
  transversal,
  onChange,
  onRemove,
}: {
  activity: Activity;
  catalog: Catalog;
  locked: boolean;
  transversal: boolean;
  onChange: (mutate: (activity: Activity) => void) => void;
  onRemove: () => void;
}) {
  const [showTeam, setShowTeam] = useState(false);
  const modalities = orderedEntries(catalog.modalities, MODALITY_ORDER).filter(([, m]) =>
    m.applicable_activity_types.includes(activity.activity_type),
  );
  const rows = Object.entries(activity.allocations).flatMap(([role, seniorities]) =>
    Object.entries(seniorities).map(([seniority, share]) => ({ role, seniority, share })),
  );
  const total = rows.reduce((sum, row) => sum + row.share, 0);
  const totalOk = Math.abs(total - 1) < 1e-6;
  const hoursOk = activity.optimistic_hours <= activity.most_likely_hours && activity.most_likely_hours <= activity.pessimistic_hours;

  function setRows(next: { role: string; seniority: string; share: number }[]) {
    onChange((a) => {
      a.allocations = {};
      for (const row of next) {
        a.allocations[row.role] = { ...(a.allocations[row.role] ?? {}), [row.seniority]: row.share };
      }
    });
  }

  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-[minmax(150px,1fr)_150px_64px_64px_64px_200px_auto_auto]">
        <fieldset disabled={locked} className="contents">
        <input
          aria-label="Atividade"
          className={cx(smallInput, "col-span-2 md:col-span-1")}
          value={activity.name}
          onChange={(e) => onChange((a) => void (a.name = e.target.value))}
        />
        <select
          aria-label="Tipo de atividade"
          className={smallInput}
          value={activity.activity_type}
          onChange={(e) =>
            onChange((a) => {
              a.activity_type = e.target.value;
              const modality = a.ai_modality ? catalog.modalities[a.ai_modality] : undefined;
              if (modality && !modality.applicable_activity_types.includes(a.activity_type)) {
                a.ai_modality = null;
                a.ai = null;
              }
            })
          }
        >
          {orderedEntries(catalog.activity_types, ACTIVITY_TYPE_ORDER).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
        {(["optimistic_hours", "most_likely_hours", "pessimistic_hours"] as const).map((field, i) => (
          <input
            key={field}
            type="number"
            min={0}
            step={0.5}
            aria-label={["Horas otimistas", "Horas mais prováveis", "Horas pessimistas"][i]}
            title={["Otimista (O)", "Mais provável (M)", "Pessimista (P)"][i]}
            className={cx(smallInput, "tabular", !hoursOk && "border-destructive")}
            value={activity[field]}
            onChange={(e) => onChange((a) => void (a[field] = toNumber(e.target.value)))}
          />
        ))}
        <select
          aria-label="Modalidade de IA"
          className={smallInput}
          value={activity.ai_modality ?? ""}
          onChange={(e) =>
            onChange((a) => {
              a.ai_modality = e.target.value || null;
              if (!a.ai_modality) a.ai = null;
            })
          }
        >
          <option value="">Sem IA</option>
          {modalities.map(([key, m]) => (
            <option key={key} value={key}>
              {m.label}
            </option>
          ))}
        </select>
        </fieldset>
        <button
          type="button"
          className={cx(buttonClasses.ghost, !totalOk && "text-destructive")}
          onClick={() => setShowTeam((v) => !v)}
          aria-expanded={showTeam}
        >
          Equipe {totalOk ? "" : `(${Math.round(total * 100)}%)`}
        </button>
        {locked ? (
          <span />
        ) : (
          <button type="button" className={buttonClasses.ghost} onClick={onRemove} aria-label="Remover atividade">
            ✕
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>O · M · P em horas</span>
        {!hoursOk && <span className="text-destructive">Use otimista ≤ mais provável ≤ pessimista.</span>}
        {activity.ai && <Badge tone="accent">Fatores de IA personalizados</Badge>}
      </div>
      {transversal && (
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          Chave de escopo
          <input
            disabled={locked}
            className={cx(smallInput, "font-mono")}
            value={activity.scope_key ?? ""}
            onChange={(e) => onChange((a) => void (a.scope_key = e.target.value || null))}
            placeholder="ex.: ci_cd"
          />
        </label>
      )}
      {showTeam && (
        <div className="mt-3 rounded-md bg-muted p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Distribuição do esforço por papel e senioridade (soma 100%)</div>
          <fieldset disabled={locked} className="flex flex-col gap-2">
            {rows.map((row, ri) => (
              <div key={`${row.role}/${row.seniority}/${ri}`} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Papel"
                  className={smallInput}
                  value={row.role}
                  onChange={(e) => setRows(rows.map((r, i) => (i === ri ? { ...r, role: e.target.value } : r)))}
                >
                  {orderedKeys(Object.keys(catalog.roles), ROLE_ORDER).map((role) => (
                    <option key={role} value={role}>
                      {label(ROLE_LABELS, role)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Senioridade"
                  className={smallInput}
                  value={row.seniority}
                  onChange={(e) => setRows(rows.map((r, i) => (i === ri ? { ...r, seniority: e.target.value } : r)))}
                >
                  {orderedKeys(Object.keys(catalog.roles[row.role] ?? {}), SENIORITY_ORDER).map((seniority) => (
                    <option key={seniority} value={seniority}>
                      {label(SENIORITY_LABELS, seniority)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  aria-label="Percentual"
                  className={cx(smallInput, "tabular w-20")}
                  value={Math.round(row.share * 1000) / 10}
                  onChange={(e) =>
                    setRows(rows.map((r, i) => (i === ri ? { ...r, share: toNumber(e.target.value) / 100 } : r)))
                  }
                />
                <span className="text-xs text-muted-foreground">%</span>
                {!locked && (
                  <button
                    type="button"
                    className={buttonClasses.ghost}
                    onClick={() => setRows(rows.filter((_, i) => i !== ri))}
                    aria-label="Remover alocação"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </fieldset>
          <div className="mt-2 flex items-center justify-between text-xs">
            <button
              type="button"
              className={cx(buttonClasses.ghost, locked && "invisible")}
              disabled={locked}
              onClick={() => setRows([...rows, { role: orderedKeys(Object.keys(catalog.roles), ROLE_ORDER)[0], seniority: "pleno", share: 0 }])}
            >
              + Alocação
            </button>
            <span className={cx("tabular font-medium", totalOk ? "text-success" : "text-destructive")}>
              Total {Math.round(total * 1000) / 10}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CostRow({
  item,
  catalog,
  onChange,
  onRemove,
}: {
  item: CostItem;
  catalog: Catalog;
  onChange: (mutate: (item: CostItem) => void) => void;
  onRemove: () => void;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <input
          aria-label="Descrição do custo"
          className={cx(smallInput, "w-full")}
          value={item.description ?? ""}
          onChange={(e) => onChange((c) => void (c.description = e.target.value))}
        />
      </td>
      <td className="px-3 py-2">
        <select
          aria-label="Tipo de custo"
          className={smallInput}
          value={item.cost_type}
          onChange={(e) => onChange((c) => void (c.cost_type = e.target.value))}
        >
          {orderedEntries(catalog.cost_types, COST_TYPE_ORDER).map(([key, type]) => (
            <option key={key} value={key}>
              {type.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          aria-label="Cenário do custo"
          className={smallInput}
          value={item.applies_to ?? ""}
          onChange={(e) => onChange((c) => void (c.applies_to = (e.target.value || null) as CostItem["applies_to"]))}
        >
          {COST_SCENARIOS.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={50}
          aria-label="Valor"
          placeholder="a confirmar"
          className={cx(smallInput, "tabular w-32")}
          value={item.amount ?? ""}
          onChange={(e) => onChange((c) => void (c.amount = e.target.value === "" ? null : toNumber(e.target.value)))}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <button type="button" className={buttonClasses.ghost} onClick={onRemove} aria-label="Remover custo">
          ✕
        </button>
      </td>
    </tr>
  );
}
