import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "primary" | "warm" | "success" | "warning";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-gradient-brand text-primary-foreground"
      : tone === "warm"
        ? "bg-gradient-warm text-accent-foreground"
        : tone === "success"
          ? "bg-success/10 text-success"
          : tone === "warning"
            ? "bg-warning/15 text-warning-foreground"
            : "bg-card text-card-foreground";

  return (
    <div className={`rounded-2xl p-5 shadow-card ${toneClass}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-2 font-display text-2xl sm:text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-80">{sub}</div>}
    </div>
  );
}
