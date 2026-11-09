"use client";
// Menu de navegação em botão "hambúrguer": abre um painel com as telas; fecha ao escolher, com Esc ou ao clicar fora.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const ITEMS = [
  { href: "/", label: "Projetos", match: (p: string) => p === "/" || p.startsWith("/projects") || p.startsWith("/estimates") },
  { href: "/calibration", label: "Calibração", match: (p: string) => p.startsWith("/calibration") },
  { href: "/parameters", label: "Parâmetros", match: (p: string) => p.startsWith("/parameters") },
];

const buttonClasses =
  "inline-flex size-9 items-center justify-center rounded-md border border-input text-foreground shadow-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50";

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

/** Mostrado enquanto o caminho atual não é conhecido (prerender de rotas dinâmicas). */
export function NavMenuFallback() {
  return (
    <button type="button" className={buttonClasses} aria-label="Abrir menu" disabled>
      <MenuIcon open={false} />
    </button>
  );
}

export function NavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Mudou de tela (inclusive pelo voltar do navegador): fecha o menu.
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={buttonClasses}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
      >
        <MenuIcon open={open} />
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label="Principal"
          className="absolute left-0 top-full z-30 mt-2 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <ul className="flex flex-col">
            {ITEMS.map((item) => {
              const current = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={
                      "block rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
                      (current ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
