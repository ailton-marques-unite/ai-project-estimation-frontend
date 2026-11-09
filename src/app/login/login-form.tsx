"use client";
import { useActionState } from "react";
import { login } from "@/app/actions";
import { Alert, Field, buttonClasses, inputClasses } from "@/components/ui";

export function LoginForm({ next, expired }: { next: string; expired: boolean }) {
  const [state, formAction, pending] = useActionState(login, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {expired && !state.error && <Alert tone="warning">Sua sessão expirou. Entre novamente.</Alert>}
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} className={inputClasses} />
      </Field>
      <Field label="Senha">
        <input name="password" type="password" autoComplete="current-password" required className={inputClasses} />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className={buttonClasses.primary}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
