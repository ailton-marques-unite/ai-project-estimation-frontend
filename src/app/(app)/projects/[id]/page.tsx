import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateEstimate, updateProjectDetails } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { ProjectEditor } from "@/components/project-editor";
import { Badge, Card, Field, PageHeader, inputClasses } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { getCatalog, getCurrentUser, getProject, listEstimates } from "@/lib/dal";
import { fmtDate, fmtHours, fmtMoney, STATUS_LABELS } from "@/lib/format";

export const metadata: Metadata = { title: "Projeto" };

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const [project, estimates, catalog, user] = await Promise.all([
    getProject(id).catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 422)) notFound();
      throw error;
    }),
    listEstimates(id),
    getCatalog(),
    getCurrentUser(),
  ]);
  const archived = project.status === "archived";
  const latest = estimates.at(-1);
  const stale = latest && latest.project_revision !== project.revision;

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`Revisão ${project.revision} dos requisitos · atualizado em ${fmtDate(project.updated_at)}`}
        back={{ href: "/", label: "Projetos" }}
        actions={archived ? <Badge>{STATUS_LABELS.archived}</Badge> : undefined}
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Estimativas">
            {!archived && (
              <ActionForm
                action={generateEstimate.bind(null, project.id)}
                submitLabel="Gerar estimativa"
                pendingLabel="Calculando…"
                className="mb-4 flex flex-col gap-3"
              >
                <p className="text-xs text-muted-foreground">
                  Calcula sobre o escopo <strong>salvo</strong> (revisão {project.revision}) com os parâmetros vigentes. Salve as
                  alterações antes.
                </p>
              </ActionForm>
            )}
            {stale && (
              <p className="mb-3 text-xs text-warning-text">
                Os requisitos mudaram desde a última estimativa; ela não pode mais ser aprovada.
              </p>
            )}
            {estimates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma estimativa ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {[...estimates].reverse().map((estimate) => (
                  <li key={estimate.id}>
                    <Link href={`/estimates/${estimate.id}`} className="flex flex-col gap-1 py-3 hover:text-primary">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">Versão {estimate.version}</span>
                        <Badge tone={estimate.status === "approved" ? "good" : "warning"}>{STATUS_LABELS[estimate.status]}</Badge>
                      </span>
                      <span className="tabular text-sm text-muted-foreground">
                        {fmtHours(estimate.base_total_hours)} → {fmtHours(estimate.ai_total_hours)} com IA
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {fmtMoney(estimate.base_total_cost)} → {fmtMoney(estimate.ai_total_cost)} · rev. {estimate.project_revision} ·
                        parâmetros {estimate.parameters_version}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Dados do projeto">
            <ActionForm action={updateProjectDetails.bind(null, project.id)} submitLabel="Salvar dados" variant="secondary">
              <Field label="Nome">
                <input name="name" required defaultValue={project.name} className={inputClasses} />
              </Field>
              <Field label="Objetivo de negócio">
                <textarea name="objective" rows={3} defaultValue={project.objective ?? ""} className={inputClasses} />
              </Field>
              <Field label="Situação">
                <select name="status" defaultValue={project.status} className={inputClasses}>
                  <option value="active">Ativo</option>
                  <option value="archived">Arquivado</option>
                </select>
              </Field>
            </ActionForm>
          </Card>
        </div>

        <ProjectEditor
          projectId={project.id}
          initial={project.content}
          catalog={catalog}
          readOnly={archived}
          canEditTechnical={user.profile === "tech_leader" || user.profile === "admin"}
        />
      </div>
    </>
  );
}
