import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions";
import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/dal";
import { PROFILE_LABELS } from "@/lib/format";
import { Alert, buttonClasses } from "@/components/ui";
import { NavMenu, NavMenuFallback } from "@/components/nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";

async function UserMenu() {
  const user = await getCurrentUser().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  });
  return (
    <div className="flex items-center gap-3 text-sm">
      {user && (
        <span className="text-right leading-tight">
          <span className="block font-medium text-foreground">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{PROFILE_LABELS[user.profile]}</span>
        </span>
      )}
      <form action={logout}>
        <button type="submit" className={buttonClasses.ghost}>
          Sair
        </button>
      </form>
    </div>
  );
}

/** Usuário autenticado no SSO, mas sem role do app: a API responde 403 em todas as rotas. */
async function AccessGate({ children }: { children: React.ReactNode }) {
  try {
    await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="mx-auto max-w-xl">
          <Alert tone="warning">
            {error.message}
            {"\n"}Peça a um administrador para atribuir uma role (product_owner, tech_leader ou admin) no domínio do Motor de Estimativa no SSO.
          </Alert>
        </div>
      );
    }
    throw error;
  }
  return children;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Suspense fallback={<NavMenuFallback />}>
              <NavMenu />
            </Suspense>
            {/* Logo com texto escuro e fundo transparente: no tema escuro ganha um fundo claro para ficar legível.
                logo_..._header.png é a logo original sem as margens e sem o slogan, que vira texto: na imagem ele
                teria ~5px de altura no cabeçalho. A posição (left/top em %) acompanha o lugar do slogan original. */}
            <Link href="/" className="shrink-0 rounded-md dark:bg-white/95 dark:px-2 dark:py-1">
              <span className="relative block">
                <Image
                  src="/assets/logo_motor_estimativa_ia_header.png"
                  alt="Motor de Estimativa em IA"
                  width={1524}
                  height={434}
                  loading="eager"
                  className="h-[72px] w-auto"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-[32.4%] top-[75%] whitespace-nowrap text-[9px] font-bold leading-none tracking-[0.08em] text-[oklch(0.525_0.064_256)]"
                >
                  ESTIME. PLANEJE. DECIDA.
                </span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Suspense fallback={<div className="h-9 w-32" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={null}>
          <AccessGate>{children}</AccessGate>
        </Suspense>
      </main>
    </>
  );
}
