import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Entrar" };

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const expired = params.sessao === "expirada";
  return <LoginForm next={next} expired={expired} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Motor de Estimativa</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre com sua conta corporativa (UNE AI SSO).</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <Suspense>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
