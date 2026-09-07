// Lightweight i18n. English + Swahili. No external deps.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "sw";

const STORAGE_KEY = "mk_locale_v1";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.signIn": "Sign in",
  "nav.getStarted": "Get started",
  "nav.product": "Product",
  "nav.landlords": "Landlords",
  "nav.help": "Help",
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.retry": "Retry",
  "auth.email": "Email",
  "auth.password": "Password",
  "rent.due": "Rent due",
  "rent.paid": "Paid",
  "rent.overdue": "Overdue",
  "fuliza.request": "Request Rent Fuliza",
  "kyc.verify": "Verify identity",
  "maintenance.report": "Report issue",
};

const sw: Dict = {
  "nav.signIn": "Ingia",
  "nav.getStarted": "Anza sasa",
  "nav.product": "Bidhaa",
  "nav.landlords": "Wamiliki",
  "nav.help": "Msaada",
  "common.loading": "Inapakia…",
  "common.save": "Hifadhi",
  "common.cancel": "Ghairi",
  "common.retry": "Jaribu tena",
  "auth.email": "Barua pepe",
  "auth.password": "Nenosiri",
  "rent.due": "Kodi inayodaiwa",
  "rent.paid": "Imelipwa",
  "rent.overdue": "Imechelewa",
  "fuliza.request": "Omba Fuliza ya Kodi",
  "kyc.verify": "Thibitisha utambulisho",
  "maintenance.report": "Ripoti tatizo",
};

const DICTS: Record<Locale, Dict> = { en, sw };

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "sw") setLocaleState(saved);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale: (l) => {
        setLocaleState(l);
        if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
      },
      t: (key) => DICTS[locale][key] ?? DICTS.en[key] ?? key,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so components outside the provider still render.
    return { locale: "en", setLocale: () => {}, t: (k) => DICTS.en[k] ?? k };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
