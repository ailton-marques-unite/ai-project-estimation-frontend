"use client";
// Sugestão de decomposição por IA para uma funcionalidade: a IA propõe, o Tech Leader revisa e aplica (RN-01).
import { useState, useTransition } from "react";
import { suggestDecomposition } from "@/app/actions";
import type { Catalog, Decomposition } from "@/lib/api/types";
import { fmtHours } from "@/lib/format";
import { Alert, Badge, buttonClasses, cx } from "@/components/ui";

type Props = {
  projectId: string;
  featureId: string;
  catalog: Catalog;
  /** Há alterações não salvas: a IA lê a funcionalidade salva, então o botão salva o escopo antes. */
  dirty: boolean;
  /** Salva o escopo; devolve uma mensagem de erro ou null. */
  saveFirst: () => Promise<string | null>;
  canApply: boolean;
  onApply: (tasks: Decomposition["tasks"]) => void;
};

function Notes({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DecompositionPanel({ projectId, featureId, catalog, dirty, saveFirst, canApply, onApply }: Props) {
  const [result, setResult] = useState<{ error?: string; suggestion?: Decomposition }>({});
  const [pending, startTransition] = useTransition();
  const suggestion = result.suggestion;

  function request() {
    startTransition(async () => {
      if (dirty) {
        const error = await saveFirst();
        if (error) {
          setResult({ error: `O escopo não foi salvo, então a IA não foi consultada: ${error}` });
          return;
        }
      }
      setResult(await suggestDecomposition(projectId, featureId));
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClasses.secondary} onClick={request} disabled={pending}>
          {pending
            ? "Consultando a IA…"
            : `${dirty ? "✦ Salvar e sugerir" : suggestion ? "✦ Sugerir de novo" : "✦ Sugerir"} tarefas com IA`}
        </button>
        {pending && <span className="text-xs text-muted-foreground">Pode levar até um minuto.</span>}
        {!pending && dirty && <span className="text-xs text-muted-foreground">A IA lê a versão salva: o escopo é salvo antes.</span>}
      </div>
      {result.error && (
        <div className="mt-3">
          <Alert tone="error">{result.error}</Alert>
        </div>
      )}
      {suggestion && (
        <div className="mt-3 flex flex-col gap-4 rounded-lg border border-dashed border-ring bg-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              Sugestão da IA <Badge tone="accent">não salva</Badge>
            </div>
            <span className="text-xs text-muted-foreground">Horas são sugestões iniciais: revise antes de aplicar e estimar.</span>
          </div>
          {suggestion.tasks.length === 0 && <p className="text-sm text-muted-foreground">A IA não propôs atividades válidas.</p>}
          {suggestion.tasks.map((task) => (
            <div key={task.name}>
              <div className="text-sm font-medium text-foreground">{task.name}</div>
              <ul className="mt-1 flex flex-col divide-y divide-border rounded-md border border-border bg-card">
                {task.activities.map((activity) => (
                  <li key={activity.name} className="flex flex-col gap-1 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-foreground">{activity.name}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {catalog.activity_types[activity.activity_type] ?? activity.activity_type} ·{" "}
                        {fmtHours(activity.optimistic_hours)} / {fmtHours(activity.most_likely_hours)} /{" "}
                        {fmtHours(activity.pessimistic_hours)} ·{" "}
                        {activity.ai_modality ? (catalog.modalities[activity.ai_modality]?.label ?? activity.ai_modality) : "Sem IA"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.rationale}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-3">
            <Notes title="Dúvidas em aberto" items={suggestion.open_questions} />
            <Notes title="Riscos" items={suggestion.risks} />
            <Notes title="Premissas" items={suggestion.assumptions} />
          </div>
          {suggestion.warnings.length > 0 && (
            <Alert tone="warning">{["Ajustes feitos pela validação:", ...suggestion.warnings].join("\n")}</Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {canApply ? (
              <button
                type="button"
                className={buttonClasses.primary}
                disabled={suggestion.tasks.length === 0}
                onClick={() => {
                  onApply(suggestion.tasks);
                  setResult({});
                }}
              >
                Aplicar ao escopo
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Somente o Tech Leader aplica sugestões ao escopo técnico.</span>
            )}
            <button type="button" className={cx(buttonClasses.ghost)} onClick={() => setResult({})}>
              Descartar
            </button>
            <span className="text-xs text-muted-foreground">Modelo: {suggestion.model}</span>
          </div>
        </div>
      )}
    </div>
  );
}
