"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/types";
import ko from "./dictionaries/ko";
import en from "./dictionaries/en";
import type { Dictionary } from "./dictionaries/types";

const dictionaries = { ko, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "cowork.locale";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "ko";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "ko" || stored === "en") return stored;
  return navigator.language.startsWith("en") ? "en" : "ko";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    // Deferred to a client-only effect (instead of a lazy initializer) so the
    // server-rendered "ko" default matches the client's first render and avoids
    // a hydration mismatch; the real locale is applied right after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: dictionaries[locale],
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
