"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export const THEMES = {
  green:  { label: "أخضر",   hex: "#0f7353" },
  blue:   { label: "أزرق",   hex: "#1d4ed8" },
  violet: { label: "بنفسجي", hex: "#6d28d9" },
  rose:   { label: "وردي",   hex: "#be123c" },
  amber:  { label: "ذهبي",   hex: "#b45309" },
} as const;

export type ThemeKey = keyof typeof THEMES;

interface ThemeCtx {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "green", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>("green");

  useEffect(() => {
    const saved = (localStorage.getItem("daftar_theme") ?? "green") as ThemeKey;
    if (saved in THEMES) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function setTheme(t: ThemeKey) {
    setThemeState(t);
    localStorage.setItem("daftar_theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
