"use client";

import { useEffect, useState } from "react";

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
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function changeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="mt-3 rounded-[18px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-2">
      <p className="px-2 text-[10px] uppercase tracking-[0.28em] text-[color:var(--text-soft)]">Tema</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => changeTheme("dark")}
          className={`flex min-h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium transition ${
            theme === "dark"
              ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.18),rgba(56,189,248,0.08))] text-[color:var(--text-primary)]"
              : "border-[color:var(--surface-border)] bg-transparent text-[color:var(--text-secondary)]"
          }`}
        >
          Escuro
        </button>
        <button
          type="button"
          onClick={() => changeTheme("light")}
          className={`flex min-h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium transition ${
            theme === "light"
              ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(11,216,194,0.18),rgba(56,189,248,0.08))] text-[color:var(--text-primary)]"
              : "border-[color:var(--surface-border)] bg-transparent text-[color:var(--text-secondary)]"
          }`}
        >
          Claro
        </button>
      </div>
    </div>
  );
}
