// Fronteira de carregamento do próprio segmento: a de (app)/ fica acima do layout compartilhado e não
// aparece em navegações entre telas, que então esperariam a API antes de trocar de página.
export { default } from "@/app/(app)/loading";
