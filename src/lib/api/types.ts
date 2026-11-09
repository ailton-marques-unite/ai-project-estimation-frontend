// Aliases dos esquemas gerados do OpenAPI da API (npm run gen:api atualiza schema.d.ts).
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Me = Schemas["MeOut"];
export type TokenResponse = Schemas["TokenResponse"];
export type Parameters = Schemas["Parameters"];
export type ParameterSetBrief = Schemas["ParameterSetBrief"];
export type ParameterSetOut = Schemas["ParameterSetOut"];
export type ProjectContent = Schemas["ProjectContent"];
export type ProjectOut = Schemas["ProjectOut"];
export type ProjectListItem = Schemas["ProjectListItem"];
export type Feature = Schemas["Feature"];
export type Task = Schemas["Task"];
export type Activity = Schemas["Activity"];
export type CostItem = Schemas["CostItem"];
export type EstimateBrief = Schemas["EstimateBrief"];
export type EstimateOut = Schemas["EstimateOut"];
export type EstimateResult = Schemas["EstimateResult"];
export type ActivityResult = Schemas["ActivityResult"];
export type ReproductionCheck = Schemas["ReproductionCheck"];
export type Decomposition = Schemas["DecompositionOut"];
export type Actual = Schemas["ActualOut"];
export type ActualInput = Schemas["ActualIn"];
export type CalibrationReport = Schemas["CalibrationReport"];
export type CalibrationGroup = Schemas["CalibrationGroup"];
export type Profile = Me["profile"];

/** Catálogo dos parâmetros vigentes usado pelo editor de projeto (tipos, modalidades, papéis, custos). */
export type Catalog = Pick<Parameters, "activity_types" | "roles" | "cost_types"> & {
  modalities: Parameters["ai"]["modalities"];
};
