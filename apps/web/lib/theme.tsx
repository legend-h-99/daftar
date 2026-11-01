"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const Provider = ThemeContext.Provider as any;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("daftar-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(t: Theme) {
      const resolved: ResolvedTheme =
        t === "system" ? (mq.matches ? "dark" : "light") : t;
      setResolvedTheme(resolved);
      root.classList.toggle("dark", resolved === "dark");
    }

    apply(theme);

    if (theme === "system") {
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  useEffect(() => {
    // Paper is always light: dark tokens print near-white text on white.
    const root = document.documentElement;
    let wasDark = false;
    const beforePrint = () => {
      if (!root.classList.contains("dark")) return;
      wasDark = true;
      root.classList.remove("dark");
    };
    const afterPrint = () => {
      if (wasDark) root.classList.add("dark");
      wasDark = false;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("daftar-theme", t);
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
