// Camada de acesso a dados: leituras da API usadas pelos Server Components.
import "server-only";
import { cache } from "react";
import { api, unwrap } from "@/lib/api/client";
import type { Catalog } from "@/lib/api/types";

export const getCurrentUser = cache(async () => unwrap((await api()).GET("/users/me")));

export const getCurrentParameters = cache(async () => unwrap((await api()).GET("/parameter-sets/current")));

export async function getCatalog(): Promise<Catalog> {
  const { content } = await getCurrentParameters();
  return {
    activity_types: content.activity_types,
    roles: content.roles,
    cost_types: content.cost_types,
    modalities: content.ai.modalities,
  };
}

export async function listProjects() {
  return unwrap((await api()).GET("/projects"));
}

export async function getProject(id: string) {
  return unwrap((await api()).GET("/projects/{project_id}", { params: { path: { project_id: id } } }));
}

export async function listEstimates(projectId: string) {
  return unwrap((await api()).GET("/projects/{project_id}/estimates", { params: { path: { project_id: projectId } } }));
}

export async function getEstimate(id: string) {
  return unwrap((await api()).GET("/estimates/{estimate_id}", { params: { path: { estimate_id: id } } }));
}

export async function checkReproduction(id: string) {
  return unwrap((await api()).GET("/estimates/{estimate_id}/reproduction", { params: { path: { estimate_id: id } } }));
}

export async function listActuals(estimateId: string) {
  return unwrap((await api()).GET("/estimates/{estimate_id}/actuals", { params: { path: { estimate_id: estimateId } } }));
}

export async function getCalibration() {
  return unwrap((await api()).GET("/calibration"));
}

export async function listParameterSets() {
  return unwrap((await api()).GET("/parameter-sets"));
}
