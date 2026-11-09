"use client";
// Formulário ligado a uma Server Action, com estado (erro/sucesso) e botão que mostra o envio.
import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { Alert, buttonClasses } from "@/components/ui";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: keyof typeof buttonClasses;
  className?: string;
  confirm?: string;
  children?: ReactNode;
};

export function ActionForm({ action, submitLabel, pendingLabel, variant = "primary", className, confirm, children }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className ?? "flex flex-col gap-4"}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <div>
        <button type="submit" disabled={pending} className={buttonClasses[variant]}>
          {pending ? (pendingLabel ?? "Enviando…") : submitLabel}
        </button>
      </div>
    </form>
  );
}
