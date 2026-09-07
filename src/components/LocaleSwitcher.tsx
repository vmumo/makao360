import { useI18n, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      aria-label="Select language"
    >
      <Globe className="size-3.5" aria-hidden />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent border border-border rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="en">English</option>
        <option value="sw">Kiswahili</option>
      </select>
    </label>
  );
}
