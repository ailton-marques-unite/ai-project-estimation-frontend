"use client";
// Tema claro/escuro: a classe `.dark` no <html> ativa os tokens escuros (globals.css).
// "Sistema" segue a preferência do sistema operacional e acompanha mudanças dela.
import { useEffect, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "theme";
const EVENT = "theme-change";

/** Executado no <head> antes da pintura (sem piscar o tema claro). Mantenha em sincronia com applyTheme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const ICON_PATHS: Record<Theme, string> = {
  system: "M3 5h18v11H3zM8 20h8M12 16v4",
  light: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  dark: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
};

function Icon({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[theme]} />
    </svg>
  );
}

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function choose(value: Theme) {
    try {
      if (value === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Sem armazenamento (navegação privada): aplica só nesta página.
    }
    applyTheme(value);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-md border border-input p-0.5 dark:bg-input/30">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          title={option.label}
          onClick={() => choose(option.value)}
          className={
            "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
            (theme === option.value
              ? "bg-secondary font-medium text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Icon theme={option.value} />
          <span className="sr-only sm:not-sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
