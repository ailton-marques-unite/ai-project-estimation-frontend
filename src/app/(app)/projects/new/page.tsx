import type { Metadata } from "next";
import { createProject } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader, inputClasses } from "@/components/ui";

export const metadata: Metadata = { title: "Novo projeto" };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="Novo projeto" back={{ href: "/", label: "Projetos" }} />
      <Card className="max-w-2xl">
        <ActionForm action={createProject} submitLabel="Criar projeto" pendingLabel="Criando…">
          <Field label="Nome do projeto">
            <input name="name" required className={inputClasses} placeholder="Portal de clientes" />
          </Field>
          <Field label="Objetivo de negócio" hint="O problema que o projeto resolve. Ajuda a revisão técnica e a decomposição.">
            <textarea name="objective" rows={3} className={inputClasses} />
          </Field>
          <p className="text-sm text-muted-foreground">
            Depois de criar, cadastre as funcionalidades, tarefas e atividades na página do projeto.
          </p>
        </ActionForm>
      </Card>
    </>
  );
}
