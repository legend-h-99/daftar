"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "ar" | "en";

interface LanguageContextValue {
  language: Language;
  dir: "rtl" | "ltr";
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

const STORAGE_KEY = "daftar_language";
const EN_TITLE = "Daftar — Simple bookkeeping for small businesses";

const LanguageContext = createContext<LanguageContextValue | null>(null);
const Provider = LanguageContext.Provider as any;

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "ar";
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start from the server-rendered default ("ar"). Reading
  // localStorage synchronously here would make the client's first render
  // diverge from the server-rendered HTML whenever a visitor had switched
  // to English before, causing a React hydration mismatch. Instead we
  // apply the stored preference after mount, once hydration is done.
  const [language, setLanguageState] = useState<Language>("ar");

  useEffect(() => {
    const stored = readInitialLanguage();
    setLanguageState((current) => (current === stored ? current : stored));
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

    // Page titles come from static Arabic metadata. In English, swap the
    // title and keep it swapped when Next.js rewrites it on navigation.
    const arabicTitle = document.title;
    if (language !== "en") return;
    const applyEnglishTitle = () => {
      if (document.title !== EN_TITLE) document.title = EN_TITLE;
    };
    applyEnglishTitle();
    const observer = new MutationObserver(applyEnglishTitle);
    // Next.js streams <title> into <body>, so watch the whole document.
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = arabicTitle;
    };
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      dir: language === "ar" ? "rtl" : "ltr",
      setLanguage,
      toggleLanguage,
    }),
    [language, setLanguage, toggleLanguage],
  );

  return (
    <Provider value={value}>
      {children}
    </Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return value;
}
