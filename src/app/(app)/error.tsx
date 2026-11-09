"use client";
import { Alert, buttonClasses } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Alert tone="error">{message}</Alert>
      <div>
        <button type="button" onClick={retry} className={buttonClasses.secondary}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
