// Multi-currency support. Amounts are stored as integer minor units where
// applicable; KES has no subunits and is stored as whole shillings — matches
// existing `formatKES` behavior.

export type Currency = "KES" | "USD" | "UGX" | "TZS";

const STORAGE_KEY = "mk_currency_v1";

type Meta = {
  symbol: string;
  locale: string;
  // Approximate FX for display-only conversion. Real rates should come from
  // a live source before charging. 1 KES => X units of target currency.
  fromKES: number;
};

const META: Record<Currency, Meta> = {
  KES: { symbol: "KES", locale: "en-KE", fromKES: 1 },
  USD: { symbol: "USD", locale: "en-US", fromKES: 0.0069 },
  UGX: { symbol: "USh", locale: "en-UG", fromKES: 28.5 },
  TZS: { symbol: "TSh", locale: "en-TZ", fromKES: 18.7 },
};

export function getCurrency(): Currency {
  if (typeof window === "undefined") return "KES";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "KES" || saved === "USD" || saved === "UGX" || saved === "TZS") return saved;
  return "KES";
}

export function setCurrency(c: Currency): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, c);
}

export function formatMoney(amountKES: number | null | undefined, currency: Currency = getCurrency()): string {
  const v = amountKES ?? 0;
  const meta = META[currency];
  const converted = v * meta.fromKES;
  return `${meta.symbol} ${converted.toLocaleString(meta.locale, { maximumFractionDigits: currency === "USD" ? 2 : 0 })}`;
}

export const SUPPORTED_CURRENCIES: Currency[] = ["KES", "USD", "UGX", "TZS"];
