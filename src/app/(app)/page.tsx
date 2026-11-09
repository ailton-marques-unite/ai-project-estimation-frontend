import Link from "next/link";
import { Suspense } from "react";
import type { EstimateBrief } from "@/lib/api/types";
import { listProjects } from "@/lib/dal";
import { fmtDate, fmtHours, STATUS_LABELS } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader, Skeleton, Stat } from "@/components/ui";

function EstimateSummary({ label, estimate }: { label: string; estimate: EstimateBrief | null }) {
  if (!estimate) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label} v{estimate.version}: </span>
      <span className="tabular font-medium text-foreground">{fmtHours(estimate.base_total_hours)}</span>
      <span className="text-muted-foreground"> sem IA · </span>
      <span className="tabular font-medium text-foreground">{fmtHours(estimate.ai_total_hours)}</span>
      <span className="text-muted-foreground"> com IA</span>
    </div>
  );
}

// Suspense dentro da página: a fronteira de (app)/loading.tsx não vale para navegações vindas de outras telas.
export default function ProjectsPage() {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <ProjectsContent />
    </Suspense>
  );
}

async function ProjectsContent() {
  const projects = await listProjects();
  const active = projects.filter((p) => p.status === "active");
  const pending = active.filter((p) => p.latest_estimate && p.latest_estimate.status === "draft").length;
  const withoutEstimate = active.filter((p) => !p.latest_estimate).length;

  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle="Estimativas de esforço e custo, com e sem IA."
        actions={<ButtonLink href="/projects/new">Novo projeto</ButtonLink>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Projetos ativos" value={active.length} />
        <Stat label="Estimativas aguardando aprovação" value={pending} note="Última versão em rascunho" />
        <Stat label="Projetos sem estimativa" value={withoutEstimate} />
      </div>
      {projects.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado ainda. Crie o primeiro para estimar suas funcionalidades.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-foreground">{project.name}</h2>
                  {project.status === "archived" ? (
                    <Badge>{STATUS_LABELS.archived}</Badge>
                  ) : project.latest_estimate ? (
                    <Badge tone={project.latest_estimate.status === "approved" ? "good" : "warning"}>
                      {project.latest_estimate.status === "approved" ? "Aprovada" : "Em revisão técnica"}
                    </Badge>
                  ) : (
                    <Badge>Sem estimativa</Badge>
                  )}
                </div>
                {project.objective && <p className="line-clamp-2 text-sm text-muted-foreground">{project.objective}</p>}
                <div className="mt-auto flex flex-col gap-1">
                  <div className="text-xs text-muted-foreground">
                    {project.feature_count} funcionalidade(s) · revisão {project.revision} · atualizado em {fmtDate(project.updated_at)}
                  </div>
                  <EstimateSummary label="Última" estimate={project.latest_estimate} />
                  {project.approved_estimate && project.approved_estimate.id !== project.latest_estimate?.id && (
                    <EstimateSummary label="Aprovada" estimate={project.approved_estimate} />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
