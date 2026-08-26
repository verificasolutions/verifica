"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "vw-theme";

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme: ThemeMode = storedTheme === "light" ? "light" : "dark";
    // A preferência só existe no navegador; o estado inicial precisa permanecer compatível com SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function changeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)] transition hover:brightness-110"
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}
